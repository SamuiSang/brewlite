'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Coffee,
  Plus,
  Trash2,
  Copy,
  Edit,
  Save,
  CheckCircle,
  AlertTriangle,
  Package,
  Layers,
  History,
  ArrowLeft,
  X,
  Search,
  RefreshCw,
  TrendingUp,
  Percent,
} from 'lucide-react';
import { useCartStore } from '@/lib/store';
import { formatVND } from '@/lib/data';

interface RecipeOverviewItem {
  id: string;
  name: string;
  category: string;
  basePrice: number;
  costPrice: number;
  marginPercent: number;
  status: 'CONFIGURED' | 'NOT_CONFIGURED';
  recipeCount: number;
  maxCupsSellable: number;
  bottleneck: string | null;
}

interface IngredientItem {
  id: string;
  name: string;
  unit: string;
  baseUnit: string;
  currentStock: number;
  minimumStock: number;
  costPerUnit: number;
  stockStatus: 'NORMAL' | 'LOW_STOCK' | 'OUT_OF_STOCK';
}

interface RecipeDetail {
  product: { id: string; name: string; basePrice: number; costPrice: number };
  recipesBySize: Record<
    string,
    {
      size: string;
      cogs: number;
      maxCups: number;
      items: {
        id: string;
        ingredientId: string;
        ingredientName: string;
        unit: string;
        amount: number;
        wasteRate: number;
        effectiveAmount: number;
        costPerUnit: number;
        lineCost: number;
        notes: string | null;
      }[];
    }
  >;
  totalIngredientsUsed: number;
}

interface InventoryLog {
  id: string;
  createdAt: string;
  type: string;
  quantity: number;
  balanceAfter: number;
  notes: string;
  ingredient: { name: string; unit: string };
}

export default function AdminRecipesPage() {
  const router = useRouter();
  const authToken = useCartStore((state) => state.authToken);
  const authUser = useCartStore((state) => state.authUser);

  const [activeTab, setActiveTab] = useState<'recipes' | 'ingredients' | 'logs'>('recipes');
  const [recipesList, setRecipesList] = useState<RecipeOverviewItem[]>([]);
  const [ingredientsList, setIngredientsList] = useState<IngredientItem[]>([]);
  const [logsList, setLogsList] = useState<InventoryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal edit recipe
  const [selectedProduct, setSelectedProduct] = useState<RecipeOverviewItem | null>(null);
  const [recipeDetail, setRecipeDetail] = useState<RecipeDetail | null>(null);
  const [activeSize, setActiveSize] = useState<'S' | 'M' | 'L'>('M');
  const [editRows, setEditRows] = useState<
    { ingredientId: string; size: string; amount: number; wasteRate: number; notes: string }[]
  >([]);
  const [isSavingRecipe, setIsSavingRecipe] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Modal copy recipe
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copyTargetProduct, setCopyTargetProduct] = useState<RecipeOverviewItem | null>(null);
  const [copySourceId, setCopySourceId] = useState<string>('');

  // Modal nhập kho nhanh
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptIngredientId, setReceiptIngredientId] = useState('');
  const [receiptQty, setReceiptQty] = useState('1');
  const [receiptUnit, setReceiptUnit] = useState('g');
  const [receiptUnitCost, setReceiptUnitCost] = useState('200');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${apiUrl}/inventory/recipes`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      if (res.ok) {
        const rawList = await res.json();
        const mapped: RecipeOverviewItem[] = rawList.map((item: any) => ({
          id: item.productId || item.id,
          name: item.productName || item.name,
          category: item.categoryName || item.category || 'Đồ uống',
          basePrice: Number(item.basePrice || 0),
          costPrice: Number(item.cogs || item.costPrice || 0),
          marginPercent: Number(item.profitMarginPercent ?? item.marginPercent ?? 0),
          status: item.recipeStatus || item.status || 'CONFIGURED',
          recipeCount: Number(item.ingredientsCount ?? item.recipeCount ?? 0),
          maxCupsSellable: Number(item.maxCups ?? item.maxCupsSellable ?? 0),
          bottleneck: item.bottleneck || null,
        }));
        setRecipesList(mapped);
      }
    } catch (e) {
      console.error('Lỗi tải danh sách công thức:', e);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, authToken]);

  const fetchIngredients = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/inventory/ingredients`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setIngredientsList(data);
      }
    } catch (e) {
      console.error('Lỗi tải danh sách nguyên liệu:', e);
    }
  }, [apiUrl, authToken]);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/inventory/transactions`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setLogsList(data);
      }
    } catch (e) {
      console.error('Lỗi tải lịch sử biến động kho:', e);
    }
  }, [apiUrl, authToken]);

  useEffect(() => {
    fetchOverview();
    fetchIngredients();
    fetchLogs();
  }, [fetchOverview, fetchIngredients, fetchLogs]);

  const openRecipeEditor = async (prod: RecipeOverviewItem) => {
    setSelectedProduct(prod);
    try {
      const res = await fetch(`${apiUrl}/inventory/recipes/${prod.id}`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      if (res.ok) {
        const detail: RecipeDetail = await res.json();
        setRecipeDetail(detail);

        // Chuẩn bị dữ liệu edit cho size hiện tại
        const currentSizeItems = detail.recipesBySize[activeSize]?.items || [];
        setEditRows(
          currentSizeItems.map((it) => ({
            ingredientId: it.ingredientId,
            size: activeSize,
            amount: it.amount,
            wasteRate: it.wasteRate,
            notes: it.notes || '',
          }))
        );
      }
    } catch (e) {
      console.error('Lỗi tải chi tiết công thức:', e);
    }
  };

  // Chuyển size trong modal
  const handleSwitchSize = (newSize: 'S' | 'M' | 'L') => {
    setActiveSize(newSize);
    if (!recipeDetail) return;
    const items = recipeDetail.recipesBySize[newSize]?.items || [];
    setEditRows(
      items.map((it) => ({
        ingredientId: it.ingredientId,
        size: newSize,
        amount: it.amount,
        wasteRate: it.wasteRate,
        notes: it.notes || '',
      }))
    );
  };

  const handleAddIngredientRow = () => {
    if (ingredientsList.length === 0) return;
    const firstIng = ingredientsList[0];
    setEditRows([
      ...editRows,
      {
        ingredientId: firstIng.id,
        size: activeSize,
        amount: 10,
        wasteRate: 0,
        notes: '',
      },
    ]);
  };

  const handleRemoveRow = (index: number) => {
    setEditRows(editRows.filter((_, i) => i !== index));
  };

  const handleRowChange = (index: number, field: string, val: any) => {
    const updated = [...editRows];
    updated[index] = { ...updated[index], [field]: val };
    setEditRows(updated);
  };

  const handleSaveRecipe = async () => {
    if (!selectedProduct) return;
    setIsSavingRecipe(true);
    try {
      // Gom lại tất cả các recipe của các size khác + size hiện tại đang sửa
      const otherSizesRows: any[] = [];
      if (recipeDetail) {
        ['S', 'M', 'L'].forEach((sz) => {
          if (sz !== activeSize) {
            const items = recipeDetail.recipesBySize[sz]?.items || [];
            items.forEach((it) => {
              otherSizesRows.push({
                ingredientId: it.ingredientId,
                size: sz,
                amount: it.amount,
                wasteRate: it.wasteRate,
                notes: it.notes,
              });
            });
          }
        });
      }

      const allRowsToSave = [...otherSizesRows, ...editRows];

      const res = await fetch(`${apiUrl}/inventory/recipes/${selectedProduct.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ recipes: allRowsToSave }),
      });

      if (res.ok) {
        showToast(`Đã lưu công thức cho món ${selectedProduct.name} thành công!`);
        await fetchOverview();
        await openRecipeEditor(selectedProduct);
      } else {
        const err = await res.json();
        alert(err.message || 'Lỗi khi lưu công thức');
      }
    } catch (e) {
      console.error(e);
      alert('Không thể kết nối đến máy chủ');
    } finally {
      setIsSavingRecipe(false);
    }
  };

  const handleCopyRecipe = async () => {
    if (!copyTargetProduct || !copySourceId) return;
    try {
      const res = await fetch(
        `${apiUrl}/inventory/recipes/${copyTargetProduct.id}/copy-from/${copySourceId}`,
        {
          method: 'POST',
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        }
      );
      if (res.ok) {
        showToast(`Đã sao chép công thức sang món ${copyTargetProduct.name}!`);
        setCopyModalOpen(false);
        fetchOverview();
      } else {
        const err = await res.json();
        alert(err.message || 'Lỗi khi sao chép');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateStockReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptIngredientId) return;

    try {
      const res = await fetch(`${apiUrl}/inventory/receipts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          supplier: 'Nhập bổ sung quầy bar',
          notes: 'Nhập nhanh từ giao diện quản trị',
          items: [
            {
              ingredientId: receiptIngredientId,
              quantity: parseFloat(receiptQty) || 1,
              unit: receiptUnit,
              unitCost: parseFloat(receiptUnitCost) || 0,
            },
          ],
        }),
      });

      if (res.ok) {
        showToast('Nhập kho thành công! Đã tự động quy đổi đơn vị.');
        setReceiptModalOpen(false);
        fetchIngredients();
        fetchLogs();
      } else {
        const err = await res.json();
        alert(err.message || 'Lỗi nhập kho');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredProducts = recipesList.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 py-8 sm:py-12 bg-[#fbf9f5] min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header Breadcrumb */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="w-9 h-9 rounded-xl bg-white border border-[#e8e2d7] flex items-center justify-center text-[#163d2c] hover:bg-[#e4ede3] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#d6955b]">
                BREWLITE INVENTORY & BOM SYSTEM
              </span>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#14241b]">
                Quản lý Định lượng & Công thức Pha chế
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fetchOverview();
                fetchIngredients();
                fetchLogs();
                showToast('Đã làm mới dữ liệu kho');
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#e8e2d7] rounded-xl text-xs font-semibold text-[#163d2c] hover:bg-[#f4efe7] transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        {/* Toast Alert */}
        {toastMsg && (
          <div className="fixed top-20 right-6 z-50 bg-[#163d2c] text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-bounce">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Tab navigation */}
        <div className="flex items-center gap-2 border-b border-[#e8e2d7] mb-6">
          <button
            onClick={() => setActiveTab('recipes')}
            className={`pb-3 px-4 text-xs font-bold transition-all relative ${
              activeTab === 'recipes'
                ? 'text-[#163d2c] border-b-2 border-[#163d2c]'
                : 'text-[#738478] hover:text-[#163d2c]'
            }`}
          >
            <div className="flex items-center gap-2">
              <Coffee className="w-4 h-4" />
              <span>Công thức Sản phẩm & COGS</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#e4ede3] text-[#163d2c]">
                {recipesList.length}
              </span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('ingredients')}
            className={`pb-3 px-4 text-xs font-bold transition-all relative ${
              activeTab === 'ingredients'
                ? 'text-[#163d2c] border-b-2 border-[#163d2c]'
                : 'text-[#738478] hover:text-[#163d2c]'
            }`}
          >
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              <span>Tồn kho Nguyên liệu thô</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#f4efe7] text-[#738478]">
                {ingredientsList.length}
              </span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`pb-3 px-4 text-xs font-bold transition-all relative ${
              activeTab === 'logs'
                ? 'text-[#163d2c] border-b-2 border-[#163d2c]'
                : 'text-[#738478] hover:text-[#163d2c]'
            }`}
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4" />
              <span>Nhật ký Biến động kho</span>
            </div>
          </button>
        </div>

        {/* TAB 1: DANH SÁCH CÔNG THỨC */}
        {activeTab === 'recipes' && (
          <div className="space-y-6">
            {/* Search bar */}
            <div className="flex items-center justify-between gap-4">
              <div className="relative w-full max-w-xs">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#94a399]" />
                <input
                  type="text"
                  placeholder="Tìm kiếm đồ uống..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-[#e8e2d7] rounded-xl text-xs text-[#14241b] focus:outline-none focus:ring-1 focus:ring-[#163d2c]"
                />
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-3xl border border-[#e8e2d7] overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f7f4ee] border-b border-[#e8e2d7] text-[#708076] uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3.5 px-5">Tên sản phẩm</th>
                    <th className="py-3.5 px-4">Danh mục</th>
                    <th className="py-3.5 px-4">Giá bán</th>
                    <th className="py-3.5 px-4">Giá vốn (COGS)</th>
                    <th className="py-3.5 px-4">Biên lợi nhuận</th>
                    <th className="py-3.5 px-4">Tối đa bán được</th>
                    <th className="py-3.5 px-4">Trạng thái BOM</th>
                    <th className="py-3.5 px-5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f2eee7]">
                  {filteredProducts.map((p) => {
                    const isConfigured = p.status === 'CONFIGURED';
                    return (
                      <tr key={p.id} className="hover:bg-[#fbf9f5] transition-colors">
                        <td className="py-4 px-5 font-bold text-[#14241b]">{p.name}</td>
                        <td className="py-4 px-4 text-[#708076]">{p.category}</td>
                        <td className="py-4 px-4 font-semibold text-[#14241b]">
                          {formatVND(p.basePrice)}
                        </td>
                        <td className="py-4 px-4 font-semibold text-[#163d2c]">
                          {isConfigured ? formatVND(p.costPrice) : '—'}
                        </td>
                        <td className="py-4 px-4">
                          {isConfigured ? (
                            <span
                              className={`inline-flex items-center gap-1 font-bold ${
                                p.marginPercent > 60
                                  ? 'text-emerald-700'
                                  : p.marginPercent > 40
                                  ? 'text-amber-700'
                                  : 'text-rose-700'
                              }`}
                            >
                              <TrendingUp className="w-3.5 h-3.5" />
                              {p.marginPercent}%
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-4 px-4">
                          {isConfigured ? (
                            <div>
                              <span className="font-bold text-[#14241b]">
                                {p.maxCupsSellable} ly
                              </span>
                              {p.bottleneck && (
                                <p className="text-[10px] text-amber-700 font-medium">
                                  Nghẽn: {p.bottleneck}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-gray-400">Chưa cấu hình</span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          {isConfigured ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#e4ede3] text-[#163d2c]">
                              <CheckCircle className="w-3 h-3 text-emerald-600" />
                              Đã có {p.recipeCount} nguyên liệu
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              Chưa cấu hình
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-5 text-right space-x-2">
                          <button
                            onClick={() => openRecipeEditor(p)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#163d2c] hover:bg-[#102f21] text-white rounded-xl text-xs font-bold transition-all shadow-2xs"
                          >
                            <Edit className="w-3 h-3" />
                            <span>Định lượng</span>
                          </button>
                          <button
                            onClick={() => {
                              setCopyTargetProduct(p);
                              setCopyModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-[#e8e2d7] text-[#163d2c] hover:bg-[#f4efe7] rounded-xl text-xs font-semibold transition-all"
                            title="Sao chép từ sản phẩm khác"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Sao chép</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: TỒN KHO NGUYÊN LIỆU THÔ */}
        {activeTab === 'ingredients' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-xs text-[#708076]">
                Quản lý số lượng tồn thực tế của từng nguyên liệu thô theo đơn vị chuẩn (g, ml, cái).
              </p>
              <button
                onClick={() => setReceiptModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#163d2c] text-white rounded-xl text-xs font-bold hover:bg-[#102f21] transition-all shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Nhập kho nhanh (Quy đổi đơn vị)</span>
              </button>
            </div>

            <div className="bg-white rounded-3xl border border-[#e8e2d7] overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f7f4ee] border-b border-[#e8e2d7] text-[#708076] uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3.5 px-5">Tên nguyên liệu</th>
                    <th className="py-3.5 px-4">Tồn kho hiện tại</th>
                    <th className="py-3.5 px-4">Định mức an toàn</th>
                    <th className="py-3.5 px-4">Giá vốn / đơn vị</th>
                    <th className="py-3.5 px-4">Trạng thái kho</th>
                    <th className="py-3.5 px-5 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f2eee7]">
                  {ingredientsList.map((ing) => (
                    <tr key={ing.id} className="hover:bg-[#fbf9f5] transition-colors">
                      <td className="py-4 px-5 font-bold text-[#14241b]">{ing.name}</td>
                      <td className="py-4 px-4 font-semibold text-[#14241b]">
                        {Number(ing.currentStock).toLocaleString('vi-VN')} {ing.unit}
                      </td>
                      <td className="py-4 px-4 text-[#708076]">
                        {Number(ing.minimumStock).toLocaleString('vi-VN')} {ing.unit}
                      </td>
                      <td className="py-4 px-4 text-[#163d2c] font-semibold">
                        {formatVND(Number(ing.costPerUnit))} / {ing.unit}
                      </td>
                      <td className="py-4 px-4">
                        {ing.stockStatus === 'NORMAL' && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#e4ede3] text-[#163d2c]">
                            Đủ nguyên liệu
                          </span>
                        )}
                        {ing.stockStatus === 'LOW_STOCK' && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Sắp hết (Dưới mức an toàn)
                          </span>
                        )}
                        {ing.stockStatus === 'OUT_OF_STOCK' && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            Hết hàng (Khóa pha chế)
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-5 text-right">
                        <button
                          onClick={() => {
                            setReceiptIngredientId(ing.id);
                            setReceiptUnit(ing.unit);
                            setReceiptUnitCost(String(ing.costPerUnit));
                            setReceiptModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-white border border-[#e8e2d7] text-[#163d2c] hover:bg-[#f4efe7] rounded-xl text-xs font-semibold"
                        >
                          Nhập thêm
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: AUDIT LOGS */}
        {activeTab === 'logs' && (
          <div className="space-y-6">
            <p className="text-xs text-[#708076]">
              Toàn bộ lịch sử xuất kho pha chế tự động theo đơn hàng và nhập hàng đối soát.
            </p>

            <div className="bg-white rounded-3xl border border-[#e8e2d7] overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f7f4ee] border-b border-[#e8e2d7] text-[#708076] uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3.5 px-5">Thời gian</th>
                    <th className="py-3.5 px-4">Loại giao dịch</th>
                    <th className="py-3.5 px-4">Nguyên liệu</th>
                    <th className="py-3.5 px-4">Số lượng biến động</th>
                    <th className="py-3.5 px-4">Tồn sau giao dịch</th>
                    <th className="py-3.5 px-5">Ghi chú đối soát</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f2eee7]">
                  {logsList.slice(0, 30).map((log) => (
                    <tr key={log.id} className="hover:bg-[#fbf9f5] transition-colors">
                      <td className="py-3.5 px-5 text-[#708076]">
                        {new Date(log.createdAt).toLocaleString('vi-VN')}
                      </td>
                      <td className="py-3.5 px-4 font-bold">
                        {log.type === 'ORDER_DEDUCT' && (
                          <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                            Xuất pha chế (Order)
                          </span>
                        )}
                        {log.type === 'RESTOCK' && (
                          <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                            Hoàn kho hủy đơn
                          </span>
                        )}
                        {log.type === 'RECEIPT' && (
                          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                            Nhập kho phiếu mới
                          </span>
                        )}
                        {log.type === 'ADJUSTMENT' && (
                          <span className="text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                            Điều chỉnh kiểm kê
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-[#14241b]">
                        {log.ingredient.name}
                      </td>
                      <td className="py-3.5 px-4 font-bold">
                        {Number(log.quantity) < 0 ? (
                          <span className="text-rose-600">{Number(log.quantity)} {log.ingredient.unit}</span>
                        ) : (
                          <span className="text-emerald-600">+{Number(log.quantity)} {log.ingredient.unit}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-[#14241b]">
                        {Number(log.balanceAfter).toLocaleString('vi-VN')} {log.ingredient.unit}
                      </td>
                      <td className="py-3.5 px-5 text-[#708076] max-w-xs truncate">
                        {log.notes}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL CẤU HÌNH CÔNG THỨC (RECIPE EDITOR) */}
        {selectedProduct && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-[#e8e2d7] overflow-hidden">
              {/* Modal header */}
              <div className="p-6 border-b border-[#e8e2d7] flex items-center justify-between bg-[#fbf9f5]">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#d6955b]">
                    ĐỊNH LƯỢNG NGUYÊN LIỆU (BOM)
                  </span>
                  <h2 className="font-serif text-2xl font-bold text-[#14241b]">
                    {selectedProduct.name}
                  </h2>
                  <p className="text-xs text-[#708076] mt-0.5">
                    Giá bán: {formatVND(selectedProduct.basePrice)} · Giá vốn tính toán (COGS):{' '}
                    <strong className="text-[#163d2c]">
                      {recipeDetail?.recipesBySize[activeSize]
                        ? formatVND(recipeDetail.recipesBySize[activeSize].cogs)
                        : formatVND(selectedProduct.costPrice)}
                    </strong>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="w-8 h-8 rounded-full bg-[#f4efe7] flex items-center justify-center text-[#708076] hover:text-[#14241b]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Size selector tabs */}
              <div className="flex border-b border-[#e8e2d7] px-6 bg-white gap-3 pt-3">
                {(['S', 'M', 'L'] as const).map((sz) => (
                  <button
                    key={sz}
                    onClick={() => handleSwitchSize(sz)}
                    className={`pb-2.5 px-4 text-xs font-bold transition-all relative ${
                      activeSize === sz
                        ? 'text-[#163d2c] border-b-2 border-[#163d2c]'
                        : 'text-[#708076] hover:text-[#163d2c]'
                    }`}
                  >
                    Size {sz} ({sz === 'S' ? 'Regular' : sz === 'M' ? 'Medium' : 'Large'})
                  </button>
                ))}
              </div>

              {/* Table of ingredients in recipe */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-[#14241b] uppercase tracking-wider">
                    Thành phần pha chế (Size {activeSize})
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddIngredientRow}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#e4ede3] text-[#163d2c] hover:bg-[#d5e3d4] rounded-xl text-xs font-bold transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm nguyên liệu</span>
                  </button>
                </div>

                {editRows.length === 0 ? (
                  <div className="p-8 text-center bg-[#fbf9f5] rounded-2xl border border-dashed border-[#e8e2d7]">
                    <p className="text-xs text-[#708076] mb-3">
                      Chưa có nguyên liệu nào được định lượng cho Size {activeSize}.
                    </p>
                    <button
                      type="button"
                      onClick={handleAddIngredientRow}
                      className="px-4 py-2 bg-[#163d2c] text-white text-xs font-bold rounded-xl"
                    >
                      Thêm thành phần đầu tiên
                    </button>
                  </div>
                ) : (
                  <div className="border border-[#e8e2d7] rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#f7f4ee] border-b border-[#e8e2d7] text-[#708076] font-semibold">
                        <tr>
                          <th className="py-2.5 px-3">Nguyên liệu</th>
                          <th className="py-2.5 px-3">Định lượng</th>
                          <th className="py-2.5 px-3">Đơn vị</th>
                          <th className="py-2.5 px-3">Hao hụt (%)</th>
                          <th className="py-2.5 px-3">Ghi chú</th>
                          <th className="py-2.5 px-3 text-center">Xóa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f2eee7]">
                        {editRows.map((row, idx) => {
                          const matchedIng = ingredientsList.find((i) => i.id === row.ingredientId);
                          return (
                            <tr key={idx} className="hover:bg-[#fbf9f5]">
                              <td className="py-2.5 px-3">
                                <select
                                  value={row.ingredientId}
                                  onChange={(e) =>
                                    handleRowChange(idx, 'ingredientId', e.target.value)
                                  }
                                  className="w-full bg-white border border-[#e8e2d7] rounded-lg px-2 py-1 text-xs text-[#14241b] focus:outline-none focus:border-[#163d2c]"
                                >
                                  {ingredientsList.map((ing) => (
                                    <option key={ing.id} value={ing.id}>
                                      {ing.name} ({formatVND(ing.costPerUnit)}/{ing.unit})
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2.5 px-3">
                                <input
                                  type="number"
                                  min="0.1"
                                  step="any"
                                  value={row.amount}
                                  onChange={(e) =>
                                    handleRowChange(idx, 'amount', parseFloat(e.target.value) || 0)
                                  }
                                  className="w-20 bg-white border border-[#e8e2d7] rounded-lg px-2 py-1 text-xs text-[#14241b] focus:outline-none focus:border-[#163d2c]"
                                />
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-[#708076]">
                                {matchedIng?.unit || 'g'}
                              </td>
                              <td className="py-2.5 px-3">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={row.wasteRate}
                                  onChange={(e) =>
                                    handleRowChange(
                                      idx,
                                      'wasteRate',
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="w-16 bg-white border border-[#e8e2d7] rounded-lg px-2 py-1 text-xs text-[#14241b] focus:outline-none focus:border-[#163d2c]"
                                />
                              </td>
                              <td className="py-2.5 px-3">
                                <input
                                  type="text"
                                  placeholder="Ghi chú pha chế..."
                                  value={row.notes || ''}
                                  onChange={(e) =>
                                    handleRowChange(idx, 'notes', e.target.value)
                                  }
                                  className="w-full bg-white border border-[#e8e2d7] rounded-lg px-2 py-1 text-xs text-[#14241b] focus:outline-none focus:border-[#163d2c]"
                                />
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRow(idx)}
                                  className="text-red-500 hover:text-red-700 p-1"
                                  title="Xóa nguyên liệu này"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Modal footer */}
              <div className="p-4 border-t border-[#e8e2d7] bg-[#fbf9f5] flex items-center justify-between">
                <p className="text-[11px] text-[#708076]">
                  Hệ thống tự động tính lại Giá vốn (COGS) và Cập nhật Tối đa số ly bán được.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    className="px-4 py-2 border border-[#e8e2d7] rounded-xl text-xs font-semibold text-[#708076] hover:bg-white"
                  >
                    Đóng
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveRecipe}
                    disabled={isSavingRecipe}
                    className="px-5 py-2 bg-[#163d2c] hover:bg-[#102f21] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSavingRecipe ? 'Đang lưu...' : 'Lưu công thức'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL SAO CHÉP CÔNG THỨC */}
        {copyModalOpen && copyTargetProduct && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#e8e2d7]">
              <h3 className="font-serif text-xl font-bold text-[#14241b] mb-1">
                Sao chép công thức
              </h3>
              <p className="text-xs text-[#708076] mb-4">
                Sao chép định lượng nguyên liệu từ một món có sẵn sang{' '}
                <strong>{copyTargetProduct.name}</strong>.
              </p>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-[#163d2c] mb-1.5">
                    Chọn sản phẩm nguồn:
                  </label>
                  <select
                    value={copySourceId}
                    onChange={(e) => setCopySourceId(e.target.value)}
                    className="w-full bg-[#fbf9f5] border border-[#e8e2d7] rounded-xl px-3 py-2.5 text-xs text-[#14241b] focus:outline-none focus:border-[#163d2c]"
                  >
                    <option value="">-- Chọn món để copy công thức --</option>
                    {recipesList
                      .filter((p) => p.id !== copyTargetProduct.id && p.status === 'CONFIGURED')
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.recipeCount} nguyên liệu)
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCopyModalOpen(false)}
                  className="px-4 py-2 border border-[#e8e2d7] rounded-xl text-xs font-semibold text-[#708076]"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleCopyRecipe}
                  disabled={!copySourceId}
                  className="px-5 py-2 bg-[#163d2c] hover:bg-[#102f21] disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Xác nhận sao chép</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL NHẬP KHO NHANH KÈM QUY ĐỔI ĐƠN VỊ */}
        {receiptModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#e8e2d7]">
              <h3 className="font-serif text-xl font-bold text-[#14241b] mb-1">
                Nhập kho nguyên liệu
              </h3>
              <p className="text-xs text-[#708076] mb-4">
                Hỗ trợ quy đổi đơn vị tự động (kg → g, l/lít → ml).
              </p>

              <form onSubmit={handleCreateStockReceipt} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#163d2c] mb-1.5">
                    Nguyên liệu nhập
                  </label>
                  <select
                    value={receiptIngredientId}
                    onChange={(e) => {
                      setReceiptIngredientId(e.target.value);
                      const ing = ingredientsList.find((i) => i.id === e.target.value);
                      if (ing) {
                        setReceiptUnit(ing.unit);
                        setReceiptUnitCost(String(ing.costPerUnit));
                      }
                    }}
                    required
                    className="w-full bg-[#fbf9f5] border border-[#e8e2d7] rounded-xl px-3 py-2 text-xs text-[#14241b]"
                  >
                    <option value="">-- Chọn nguyên liệu --</option>
                    {ingredientsList.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} (Hiện có: {i.currentStock} {i.unit})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#163d2c] mb-1.5">
                      Số lượng
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      value={receiptQty}
                      onChange={(e) => setReceiptQty(e.target.value)}
                      required
                      className="w-full bg-[#fbf9f5] border border-[#e8e2d7] rounded-xl px-3 py-2 text-xs text-[#14241b]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#163d2c] mb-1.5">
                      Đơn vị nhập
                    </label>
                    <select
                      value={receiptUnit}
                      onChange={(e) => setReceiptUnit(e.target.value)}
                      className="w-full bg-[#fbf9f5] border border-[#e8e2d7] rounded-xl px-3 py-2 text-xs text-[#14241b]"
                    >
                      <option value="g">g (Gam)</option>
                      <option value="kg">kg (Kilôgam)</option>
                      <option value="ml">ml (Mililít)</option>
                      <option value="l">l / lít (Lít)</option>
                      <option value="piece">piece / cái</option>
                      <option value="hộp">hộp</option>
                      <option value="chai">chai</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#163d2c] mb-1.5">
                    Đơn giá nhập (₫ / đơn vị nhập)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={receiptUnitCost}
                    onChange={(e) => setReceiptUnitCost(e.target.value)}
                    required
                    className="w-full bg-[#fbf9f5] border border-[#e8e2d7] rounded-xl px-3 py-2 text-xs text-[#14241b]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setReceiptModalOpen(false)}
                    className="px-4 py-2 border border-[#e8e2d7] rounded-xl text-xs font-semibold text-[#708076]"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#163d2c] hover:bg-[#102f21] text-white rounded-xl text-xs font-bold"
                  >
                    Nhập kho
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
