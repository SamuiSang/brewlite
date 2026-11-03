import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { CreateStockReceiptDto } from './dto/create-receipt.dto';
import { SetProductRecipeDto } from './dto/set-recipe.dto';
import { ValidateCartDto } from './dto/validate-cart.dto';
import { UnitConverter } from './unit-converter';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lấy danh sách toàn bộ nguyên liệu kèm trạng thái cảnh báo tồn kho & số sản phẩm sử dụng
   * GET /inventory/ingredients
   */
  async findAllIngredients() {
    const ingredients = await this.prisma.ingredient.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { recipes: true },
        },
      },
    });

    return ingredients.map((ing) => {
      const current = Number(ing.currentStock);
      const min = Number(ing.minimumStock);
      let status: 'NORMAL' | 'LOW_STOCK' | 'OUT_OF_STOCK' = 'NORMAL';
      if (current <= 0) {
        status = 'OUT_OF_STOCK';
      } else if (current <= min) {
        status = 'LOW_STOCK';
      }

      return {
        id: ing.id,
        name: ing.name,
        unit: ing.unit,
        baseUnit: ing.baseUnit || UnitConverter.getBaseUnit(ing.unit),
        currentStock: current,
        minimumStock: min,
        costPerUnit: Number(ing.costPerUnit),
        status,
        warning:
          status === 'OUT_OF_STOCK'
            ? 'Đã hết hàng'
            : status === 'LOW_STOCK'
              ? 'Tồn kho sắp hết (dưới định mức tối thiểu)'
              : 'Tồn kho an toàn',
        recipesCount: ing._count.recipes,
        updatedAt: ing.updatedAt,
      };
    });
  }

  /**
   * Tạo nguyên liệu mới
   * POST /inventory/ingredients
   */
  async createIngredient(dto: CreateIngredientDto) {
    const existing = await this.prisma.ingredient.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new BadRequestException(`Nguyên liệu "${dto.name}" đã tồn tại`);
    }

    const baseUnit = UnitConverter.getBaseUnit(dto.unit);
    const initialStock = dto.initialStock || 0;
    const ing = await this.prisma.ingredient.create({
      data: {
        name: dto.name,
        unit: dto.unit,
        baseUnit,
        currentStock: initialStock,
        minimumStock: dto.minimumStock || 100,
        costPerUnit: dto.costPerUnit || 0,
      },
    });

    if (initialStock > 0) {
      await this.prisma.inventoryTransaction.create({
        data: {
          ingredientId: ing.id,
          type: 'RECEIPT',
          quantity: initialStock,
          balanceAfter: initialStock,
          referenceType: 'MANUAL',
          notes: 'Khởi tạo tồn kho ban đầu',
        },
      });
    }

    return ing;
  }

  /**
   * Cập nhật thông tin nguyên liệu
   * PATCH /inventory/ingredients/:id
   */
  async updateIngredient(
    id: string,
    dto: {
      name?: string;
      unit?: string;
      minimumStock?: number;
      costPerUnit?: number;
    },
  ) {
    const ing = await this.prisma.ingredient.findUnique({ where: { id } });
    if (!ing) {
      throw new NotFoundException('Không tìm thấy nguyên liệu');
    }

    const data: any = {};
    if (dto.name) data.name = dto.name;
    if (dto.unit) {
      data.unit = dto.unit;
      data.baseUnit = UnitConverter.getBaseUnit(dto.unit);
    }
    if (dto.minimumStock !== undefined) data.minimumStock = dto.minimumStock;
    if (dto.costPerUnit !== undefined) data.costPerUnit = dto.costPerUnit;

    return this.prisma.ingredient.update({
      where: { id },
      data,
    });
  }

  /**
   * Điều chỉnh tồn kho thủ công (kiểm kê, hao hụt, hỏng hóc)
   * PATCH /inventory/ingredients/:id/adjust
   */
  async adjustStock(id: string, dto: AdjustStockDto, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const ing = await tx.ingredient.findUnique({ where: { id } });
      if (!ing) {
        throw new NotFoundException(`Không tìm thấy nguyên liệu với ID "${id}"`);
      }

      const currentStock = Number(ing.currentStock);
      let adjustment = Number(dto.quantityChange);

      if (dto.reason === 'OVERWRITE') {
        adjustment = Number(dto.quantityChange) - currentStock;
      }

      const newStock = currentStock + adjustment;
      if (newStock < 0) {
        throw new BadRequestException(
          `Tồn kho không thể âm. Hiện tại: ${currentStock} ${ing.unit}, điều chỉnh: ${adjustment} ${ing.unit}`,
        );
      }

      const updated = await tx.ingredient.update({
        where: { id },
        data: { currentStock: newStock },
      });

      await tx.inventoryTransaction.create({
        data: {
          ingredientId: ing.id,
          type: 'ADJUSTMENT',
          quantity: adjustment,
          balanceAfter: newStock,
          referenceType: 'MANUAL_ADJUSTMENT',
          notes: dto.notes || `Điều chỉnh kho thủ công (${dto.reason})`,
        },
      });

      return {
        message: 'Điều chỉnh tồn kho thành công',
        ingredient: {
          id: updated.id,
          name: updated.name,
          unit: updated.unit,
          previousStock: currentStock,
          adjustment,
          currentStock: newStock,
        },
      };
    });
  }

  /**
   * Nhập kho nguyên liệu (Hỗ trợ quy đổi đơn vị: ví dụ nhập kg -> tự động đổi ra g)
   * POST /inventory/receipts
   */
  async createStockReceipt(dto: CreateStockReceiptDto, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const code = dto.receiptCode || `PNK-${Date.now().toString().slice(-6)}`;

      let totalCost = 0;
      for (const item of dto.items) {
        totalCost += item.quantity * item.unitCost;
      }

      const receipt = await tx.stockReceipt.create({
        data: {
          receiptCode: code,
          supplier: dto.supplier || 'Nhà cung cấp chuẩn F&B',
          totalCost,
          notes: dto.notes,
          receivedById: userId || null,
        },
      });

      const receiptItems = [];

      for (const item of dto.items) {
        const ing = await tx.ingredient.findUnique({
          where: { id: item.ingredientId },
        });

        if (!ing) {
          throw new NotFoundException(
            `Không tìm thấy nguyên liệu với ID "${item.ingredientId}"`,
          );
        }

        // Quy đổi đơn vị nếu đơn vị nhập khác đơn vị chuẩn của nguyên liệu
        let convertedQty = item.quantity;
        let convertedUnitCost = item.unitCost;

        if (item.unit && item.unit !== ing.unit) {
          convertedQty = UnitConverter.convert(item.quantity, item.unit, ing.unit);
          // Đơn giá sau quy đổi = Tổng tiền dòng / Số lượng sau quy đổi
          convertedUnitCost = (item.quantity * item.unitCost) / convertedQty;
        }

        const currentStock = Number(ing.currentStock);
        const newStock = currentStock + convertedQty;

        // Cập nhật giá vốn bình quân gia quyền hoặc giá nhập mới nhất
        await tx.ingredient.update({
          where: { id: ing.id },
          data: {
            currentStock: newStock,
            costPerUnit: Math.round(convertedUnitCost * 100) / 100,
          },
        });

        // Tạo dòng chi tiết phiếu nhập
        const lineItem = await tx.stockReceiptItem.create({
          data: {
            receiptId: receipt.id,
            ingredientId: ing.id,
            quantity: convertedQty,
            unitCost: convertedUnitCost,
            totalPrice: item.quantity * item.unitCost,
          },
        });
        receiptItems.push(lineItem);

        // Ghi nhật ký biến động kho
        const noteDetail =
          item.unit && item.unit !== ing.unit
            ? `Nhập kho theo phiếu ${code}: ${item.quantity} ${item.unit} (quy đổi: +${convertedQty} ${ing.unit})`
            : `Nhập kho theo phiếu ${code}: +${convertedQty} ${ing.unit}`;

        await tx.inventoryTransaction.create({
          data: {
            ingredientId: ing.id,
            type: 'RECEIPT',
            quantity: convertedQty,
            balanceAfter: newStock,
            referenceType: 'STOCK_RECEIPT',
            stockReceiptId: receipt.id,
            notes: noteDetail,
          },
        });
      }

      return {
        message: 'Tạo phiếu nhập kho thành công',
        receipt: {
          id: receipt.id,
          receiptCode: receipt.receiptCode,
          totalCost,
          itemCount: receiptItems.length,
        },
      };
    });
  }

  /**
   * Danh sách tổng quan công thức của toàn bộ sản phẩm
   * GET /inventory/recipes
   */
  async getAllRecipesOverview() {
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      include: {
        category: true,
        recipes: {
          include: { ingredient: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return products.map((p) => {
      const hasRecipe = p.recipes.length > 0;
      const basePrice = Number(p.basePrice);

      // Tính giá vốn (COGS) theo size M hoặc trung bình
      const recipesM = p.recipes.filter((r) => r.size === 'M' || r.size === null);
      const activeRecipes = recipesM.length > 0 ? recipesM : p.recipes;

      let cogs = 0;
      let minCups = Infinity;

      for (const r of activeRecipes) {
        const amount = Number(r.amount);
        const wasteRate = Number(r.wasteRate || 0);
        const effectiveAmount = amount * (1 + wasteRate / 100);
        const costPerUnit = Number(r.ingredient.costPerUnit);
        cogs += effectiveAmount * costPerUnit;

        const stock = Number(r.ingredient.currentStock);
        if (effectiveAmount > 0) {
          const possible = Math.floor(stock / effectiveAmount);
          if (possible < minCups) minCups = possible;
        }
      }

      const roundedCogs = Math.round(cogs);
      const profit = Math.max(0, basePrice - roundedCogs);
      const profitMarginPercent =
        basePrice > 0 ? Math.round((profit / basePrice) * 100) : 0;
      const maxCups = minCups === Infinity ? (hasRecipe ? 0 : 0) : Math.max(0, minCups);

      return {
        productId: p.id,
        productName: p.name,
        categoryName: p.category.name,
        basePrice,
        cogs: roundedCogs,
        profit,
        profitMarginPercent,
        hasRecipe,
        recipeStatus: hasRecipe ? 'CONFIGURED' : 'NOT_CONFIGURED',
        recipeStatusLabel: hasRecipe ? 'Đã thiết lập' : 'Chưa thiết lập',
        ingredientsCount: p.recipes.length,
        maxCups,
        imageUrl: p.imageUrl,
      };
    });
  }

  /**
   * Lấy công thức chi tiết của sản phẩm (BOM), tính toán COGS và khả năng pha chế
   * GET /inventory/recipes/:productId
   */
  async getProductRecipe(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        recipes: {
          include: { ingredient: true },
          orderBy: [{ size: 'asc' }, { ingredient: { name: 'asc' } }],
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }

    const hasRecipe = product.recipes.length > 0;
    const basePrice = Number(product.basePrice);

    // Gom công thức theo size: S, M, L
    const sizes: Array<'S' | 'M' | 'L'> = ['S', 'M', 'L'];
    const recipesBySize: Record<string, any> = {};

    for (const sz of sizes) {
      let items = product.recipes.filter((r) => r.size === sz);
      if (items.length === 0) {
        items = product.recipes.filter((r) => r.size === null);
      }

      let totalCost = 0;
      let minCups = Infinity;
      let bottleneck = null;

      const details = items.map((r) => {
        const amount = Number(r.amount);
        const wasteRate = Number(r.wasteRate || 0);
        const effectiveAmount = amount * (1 + wasteRate / 100);
        const costPerUnit = Number(r.ingredient.costPerUnit);
        const lineCost = Math.round(effectiveAmount * costPerUnit);
        totalCost += lineCost;

        const stock = Number(r.ingredient.currentStock);
        const possibleCups =
          effectiveAmount > 0 ? Math.floor(stock / effectiveAmount) : Infinity;

        if (possibleCups < minCups) {
          minCups = possibleCups;
          bottleneck = r.ingredient.name;
        }

        return {
          id: r.id,
          ingredientId: r.ingredientId,
          ingredientName: r.ingredient.name,
          unit: r.ingredient.unit,
          amount,
          wasteRate,
          effectiveAmount: Math.round(effectiveAmount * 100) / 100,
          costPerUnit,
          lineCost,
          currentStock: stock,
          possibleCups: possibleCups === Infinity ? 0 : possibleCups,
          notes: r.notes,
        };
      });

      const sizeExtra = sz === 'S' ? 0 : sz === 'M' ? 5000 : 10000;
      const price = basePrice + sizeExtra;
      const profit = Math.max(0, price - totalCost);
      const profitMarginPercent = price > 0 ? Math.round((profit / price) * 100) : 0;

      recipesBySize[sz] = {
        size: sz,
        price,
        totalCost,
        profit,
        profitMarginPercent,
        maxCups: minCups === Infinity ? 0 : Math.max(0, minCups),
        bottleneck,
        ingredients: details,
      };
    }

    return {
      productId: product.id,
      productName: product.name,
      categoryName: product.category.name,
      basePrice,
      hasRecipe,
      recipeStatus: hasRecipe ? 'CONFIGURED' : 'NOT_CONFIGURED',
      recipeStatusLabel: hasRecipe ? 'Đã thiết lập' : 'Chưa thiết lập',
      bySize: recipesBySize,
      allRecipeItems: product.recipes.map((r) => ({
        id: r.id,
        ingredientId: r.ingredientId,
        ingredientName: r.ingredient.name,
        size: r.size,
        amount: Number(r.amount),
        wasteRate: Number(r.wasteRate || 0),
        unit: r.ingredient.unit,
        costPerUnit: Number(r.ingredient.costPerUnit),
      })),
    };
  }

  /**
   * Cập nhật công thức cho sản phẩm (BOM) & Tự động tính lại giá vốn (COGS)
   * POST /inventory/recipes
   */
  async setProductRecipe(dto: SetProductRecipeDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Xóa toàn bộ công thức cũ của sản phẩm
      await tx.productRecipe.deleteMany({ where: { productId: dto.productId } });

      let calculatedCogs = 0;

      // 2. Thêm mới từng dòng công thức
      for (const item of dto.recipes) {
        const ing = await tx.ingredient.findUnique({
          where: { id: item.ingredientId },
        });
        if (!ing) {
          throw new NotFoundException(
            `Không tìm thấy nguyên liệu với ID "${item.ingredientId}"`,
          );
        }

        const wasteRate = item.wasteRate !== undefined ? item.wasteRate : 0;
        await tx.productRecipe.create({
          data: {
            productId: dto.productId,
            ingredientId: item.ingredientId,
            size: item.size || null,
            amount: item.amount,
            wasteRate,
            notes: item.notes || null,
          },
        });

        // Tính chi phí đóng góp vào giá vốn sản phẩm (size M hoặc chung)
        if (item.size === 'M' || item.size === null || !item.size) {
          const effective = item.amount * (1 + wasteRate / 100);
          calculatedCogs += effective * Number(ing.costPerUnit);
        }
      }

      // 3. Cập nhật giá vốn vào bảng Product (COGS)
      await tx.product.update({
        where: { id: dto.productId },
        data: { costPrice: Math.round(calculatedCogs) },
      });

      return {
        message: 'Cập nhật công thức và tính toán giá vốn thành công',
        productId: dto.productId,
        productName: product.name,
        recipeCount: dto.recipes.length,
        costPrice: Math.round(calculatedCogs),
      };
    });
  }

  /**
   * Sao chép công thức từ sản phẩm khác (Copy Recipe)
   * POST /inventory/recipes/:productId/copy-from/:sourceProductId
   */
  async copyProductRecipe(targetProductId: string, sourceProductId: string) {
    if (targetProductId === sourceProductId) {
      throw new BadRequestException('Sản phẩm nguồn và đích không được trùng nhau');
    }

    const [targetProduct, sourceProduct] = await Promise.all([
      this.prisma.product.findUnique({ where: { id: targetProductId } }),
      this.prisma.product.findUnique({
        where: { id: sourceProductId },
        include: { recipes: true },
      }),
    ]);

    if (!targetProduct) {
      throw new NotFoundException(`Không tìm thấy sản phẩm đích: ${targetProductId}`);
    }
    if (!sourceProduct) {
      throw new NotFoundException(`Không tìm thấy sản phẩm nguồn: ${sourceProductId}`);
    }

    if (sourceProduct.recipes.length === 0) {
      throw new BadRequestException(
        `Sản phẩm nguồn "${sourceProduct.name}" chưa có công thức để sao chép`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Xóa công thức cũ của sản phẩm đích
      await tx.productRecipe.deleteMany({ where: { productId: targetProductId } });

      // Sao chép từng nguyên liệu
      for (const r of sourceProduct.recipes) {
        await tx.productRecipe.create({
          data: {
            productId: targetProductId,
            ingredientId: r.ingredientId,
            size: r.size,
            amount: r.amount,
            wasteRate: r.wasteRate,
            notes: `Sao chép từ ${sourceProduct.name}`,
          },
        });
      }

      // Đồng bộ giá vốn
      await tx.product.update({
        where: { id: targetProductId },
        data: { costPrice: sourceProduct.costPrice },
      });

      return {
        message: `Sao chép thành công ${sourceProduct.recipes.length} dòng công thức từ "${sourceProduct.name}" sang "${targetProduct.name}"`,
        targetProductId,
        copiedItemsCount: sourceProduct.recipes.length,
      };
    });
  }

  /**
   * Xóa một nguyên liệu ra khỏi công thức của sản phẩm
   * DELETE /inventory/recipes/:productId/ingredient/:ingredientId?size=M
   */
  async deleteRecipeIngredient(
    productId: string,
    ingredientId: string,
    size?: string,
  ) {
    const where: any = { productId, ingredientId };
    if (size) where.size = size;

    const deleted = await this.prisma.productRecipe.deleteMany({ where });

    if (deleted.count === 0) {
      throw new NotFoundException('Không tìm thấy dòng nguyên liệu trong công thức');
    }

    return {
      message: 'Đã xóa nguyên liệu khỏi công thức',
      deletedCount: deleted.count,
    };
  }

  /**
   * Tính số ly tối đa có thể sản xuất cho một sản phẩm dựa trên nguyên liệu hiện có (BOM)
   * GET /inventory/availability/:productId?size=M
   */
  async calculateProductAvailability(productId: string, size: 'S' | 'M' | 'L' = 'M') {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }

    // Lấy công thức tương ứng với size (hoặc size = null dùng chung)
    let recipes = await this.prisma.productRecipe.findMany({
      where: { productId, size },
      include: { ingredient: true },
    });

    if (recipes.length === 0) {
      recipes = await this.prisma.productRecipe.findMany({
        where: { productId, size: null },
        include: { ingredient: true },
      });
    }

    if (recipes.length === 0) {
      return {
        productId: product.id,
        productName: product.name,
        size,
        hasRecipe: false,
        maxCups: 0,
        bottlenecks: [],
        message: 'Sản phẩm chưa được thiết lập công thức pha chế',
      };
    }

    let minCups = Infinity;
    const bottlenecks = [];

    for (const r of recipes) {
      const stock = Number(r.ingredient.currentStock);
      const amount = Number(r.amount);
      const wasteRate = Number(r.wasteRate || 0);
      const effectivePerCup = amount * (1 + wasteRate / 100);

      const possibleCups =
        effectivePerCup > 0 ? Math.floor(stock / effectivePerCup) : Infinity;

      bottlenecks.push({
        ingredientName: r.ingredient.name,
        unit: r.ingredient.unit,
        currentStock: stock,
        requiredPerCup: amount,
        wasteRate,
        effectivePerCup: Math.round(effectivePerCup * 100) / 100,
        possibleCups,
      });

      if (possibleCups < minCups) {
        minCups = possibleCups;
      }
    }

    return {
      productId: product.id,
      productName: product.name,
      size,
      hasRecipe: true,
      maxCups: minCups === Infinity ? 0 : Math.max(0, minCups),
      ingredientsDetail: bottlenecks,
    };
  }

  /**
   * Lấy lịch sử biến động kho (Audit log)
   * GET /inventory/transactions
   */
  async getTransactions(query: {
    ingredientId?: string;
    type?: string;
    limit?: number;
  }) {
    const limit = query.limit || 50;
    const where: any = {};
    if (query.ingredientId) where.ingredientId = query.ingredientId;
    if (query.type) where.type = query.type;

    const list = await this.prisma.inventoryTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        ingredient: true,
        order: {
          select: {
            id: true,
            orderCode: true,
            customerName: true,
            status: true,
          },
        },
        stockReceipt: {
          select: {
            id: true,
            receiptCode: true,
            supplier: true,
          },
        },
      },
    });

    return list.map((tx) => ({
      id: tx.id,
      type: tx.type,
      ingredientId: tx.ingredientId,
      ingredientName: tx.ingredient.name,
      unit: tx.ingredient.unit,
      quantity: Number(tx.quantity),
      balanceAfter: Number(tx.balanceAfter),
      referenceType: tx.referenceType,
      referenceId: tx.order?.orderCode || tx.stockReceipt?.receiptCode || null,
      notes: tx.notes,
      createdAt: tx.createdAt,
    }));
  }

  /**
   * Kiểm tra giỏ hàng với tồn kho thực tế của nguyên liệu (BOM)
   * POST /inventory/validate-cart
   */
  async validateCart(dto: ValidateCartDto) {
    if (!dto.items || dto.items.length === 0) {
      return { isValid: true, items: [], insufficientIngredients: [] };
    }

    const productIds = Array.from(new Set(dto.items.map((it) => it.productId)));
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        recipes: {
          include: { ingredient: true },
        },
      },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    // 1. Thu thập toàn bộ nguyên liệu cần thiết cho toàn bộ giỏ hàng
    const totalRequiredMap = new Map<string, { id: string; name: string; unit: string; requiredAmount: number }>();

    // 2. Phân tích từng item trong giỏ hàng
    const itemResults = [];

    for (const item of dto.items) {
      const product = productMap.get(item.productId);
      const prodName = product?.name || 'Sản phẩm';
      const size = item.size || 'M';

      if (!product) {
        itemResults.push({
          productId: item.productId,
          productName: prodName,
          size,
          requestedQuantity: item.quantity,
          maxAvailable: 0,
          suggestedQuantity: 0,
          status: 'OUT_OF_STOCK',
          bottleneckIngredient: null,
          message: `Sản phẩm không tồn tại`,
        });
        continue;
      }

      // Tìm công thức theo size
      let recipes = product.recipes.filter((r) => r.size === size);
      if (recipes.length === 0) {
        recipes = product.recipes.filter((r) => r.size === null);
      }
      if (recipes.length === 0 && product.recipes.length > 0) {
        recipes = product.recipes;
      }

      if (recipes.length === 0) {
        itemResults.push({
          productId: item.productId,
          productName: prodName,
          size,
          requestedQuantity: item.quantity,
          maxAvailable: 0,
          suggestedQuantity: 0,
          status: 'NO_RECIPE',
          bottleneckIngredient: null,
          message: `Món "${prodName}" chưa có công thức định lượng (BOM)`,
        });
        continue;
      }

      // Tính max cups và bottleneck cho item này dựa trên tồn kho hiện tại
      let itemMinCups = Infinity;
      let itemBottleneck = null;

      for (const r of recipes) {
        const amount = Number(r.amount);
        const wasteRate = Number(r.wasteRate || 0);
        const effectivePerCup = amount * (1 + wasteRate / 100);
        const totalNeededForItem = Math.round(effectivePerCup * item.quantity * 100) / 100;

        // Cộng vào tổng yêu cầu toàn giỏ hàng
        const existingTotal = totalRequiredMap.get(r.ingredientId);
        if (existingTotal) {
          existingTotal.requiredAmount = Math.round((existingTotal.requiredAmount + totalNeededForItem) * 100) / 100;
        } else {
          totalRequiredMap.set(r.ingredientId, {
            id: r.ingredientId,
            name: r.ingredient.name,
            unit: r.ingredient.unit,
            requiredAmount: totalNeededForItem,
          });
        }

        const stock = Number(r.ingredient.currentStock);
        const cupsPossible = effectivePerCup > 0 ? Math.floor(stock / effectivePerCup) : Infinity;
        if (cupsPossible < itemMinCups) {
          itemMinCups = cupsPossible;
          itemBottleneck = r.ingredient.name;
        }
      }

      const maxAvailable = itemMinCups === Infinity ? 0 : Math.max(0, itemMinCups);
      let status: 'AVAILABLE' | 'INSUFFICIENT_QUANTITY' | 'OUT_OF_STOCK' = 'AVAILABLE';
      let message = 'Còn đủ nguyên liệu';

      if (maxAvailable === 0) {
        status = 'OUT_OF_STOCK';
        message = `Hết nguyên liệu: thiếu ${itemBottleneck || 'nguyên liệu pha chế'}`;
      } else if (item.quantity > maxAvailable) {
        status = 'INSUFFICIENT_QUANTITY';
        message = `Hiện chỉ còn nguyên liệu để phục vụ tối đa ${maxAvailable} ly (thiếu ${itemBottleneck})`;
      }

      itemResults.push({
        productId: item.productId,
        productName: prodName,
        size,
        requestedQuantity: item.quantity,
        maxAvailable,
        suggestedQuantity: Math.min(item.quantity, maxAvailable),
        status,
        bottleneckIngredient: itemBottleneck,
        message,
      });
    }

    // 3. Đối chiếu tổng nguyên liệu cần với tồn kho thực tế
    const insufficientIngredients = [];
    for (const [ingId, req] of totalRequiredMap.entries()) {
      const ing = await this.prisma.ingredient.findUnique({ where: { id: ingId } });
      if (ing) {
        const stock = Number(ing.currentStock);
        if (stock < req.requiredAmount) {
          insufficientIngredients.push({
            id: ingId,
            name: req.name,
            unit: req.unit,
            currentStock: stock,
            requiredAmount: req.requiredAmount,
            missingAmount: Math.round((req.requiredAmount - stock) * 100) / 100,
          });
        }
      }
    }

    const isValid = insufficientIngredients.length === 0 && itemResults.every((it) => it.status === 'AVAILABLE');

    return {
      isValid,
      items: itemResults,
      insufficientIngredients,
    };
  }
}
