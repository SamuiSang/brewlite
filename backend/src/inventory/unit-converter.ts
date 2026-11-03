import { BadRequestException } from '@nestjs/common';

export type UnitType = 'MASS' | 'VOLUME' | 'COUNT';

interface UnitDef {
  type: UnitType;
  baseUnit: string;
  factor: number; // Factor quy đổi về đơn vị chuẩn (g, ml, piece)
}

export class UnitConverter {
  private static readonly UNIT_REGISTRY: Record<string, UnitDef> = {
    // Khối lượng (Cơ sở: g)
    g: { type: 'MASS', baseUnit: 'g', factor: 1 },
    gram: { type: 'MASS', baseUnit: 'g', factor: 1 },
    gam: { type: 'MASS', baseUnit: 'g', factor: 1 },
    kg: { type: 'MASS', baseUnit: 'g', factor: 1000 },
    kilogram: { type: 'MASS', baseUnit: 'g', factor: 1000 },
    kilo: { type: 'MASS', baseUnit: 'g', factor: 1000 },
    mg: { type: 'MASS', baseUnit: 'g', factor: 0.001 },

    // Thể tích (Cơ sở: ml)
    ml: { type: 'VOLUME', baseUnit: 'ml', factor: 1 },
    mililit: { type: 'VOLUME', baseUnit: 'ml', factor: 1 },
    l: { type: 'VOLUME', baseUnit: 'ml', factor: 1000 },
    lit: { type: 'VOLUME', baseUnit: 'ml', factor: 1000 },
    lít: { type: 'VOLUME', baseUnit: 'ml', factor: 1000 },

    // Đơn vị đếm (Cơ sở: piece)
    piece: { type: 'COUNT', baseUnit: 'piece', factor: 1 },
    cái: { type: 'COUNT', baseUnit: 'piece', factor: 1 },
    cai: { type: 'COUNT', baseUnit: 'piece', factor: 1 },
    chiếc: { type: 'COUNT', baseUnit: 'piece', factor: 1 },
    chiec: { type: 'COUNT', baseUnit: 'piece', factor: 1 },
    ly: { type: 'COUNT', baseUnit: 'piece', factor: 1 },
    hộp: { type: 'COUNT', baseUnit: 'piece', factor: 1 },
    hop: { type: 'COUNT', baseUnit: 'piece', factor: 1 },
    chai: { type: 'COUNT', baseUnit: 'piece', factor: 1 },
    gói: { type: 'COUNT', baseUnit: 'piece', factor: 1 },
    goi: { type: 'COUNT', baseUnit: 'piece', factor: 1 },
    túi: { type: 'COUNT', baseUnit: 'piece', factor: 1 },
    tui: { type: 'COUNT', baseUnit: 'piece', factor: 1 },
    thùng: { type: 'COUNT', baseUnit: 'piece', factor: 1 },
    thung: { type: 'COUNT', baseUnit: 'piece', factor: 1 },
  };

  /**
   * Chuẩn hóa tên đơn vị (viết thường, bỏ dấu khoảng trắng thừa)
   */
  static normalizeUnit(unit: string): string {
    return (unit || '').trim().toLowerCase();
  }

  /**
   * Lấy đơn vị cơ sở chuẩn (base unit) của một đơn vị bất kỳ
   */
  static getBaseUnit(unit: string): string {
    const key = this.normalizeUnit(unit);
    const def = this.UNIT_REGISTRY[key];
    return def ? def.baseUnit : key;
  }

  /**
   * Kiểm tra xem 2 đơn vị có tương thích để quy đổi hay không
   */
  static areCompatible(unitA: string, unitB: string): boolean {
    const keyA = this.normalizeUnit(unitA);
    const keyB = this.normalizeUnit(unitB);

    if (keyA === keyB) return true;

    const defA = this.UNIT_REGISTRY[keyA];
    const defB = this.UNIT_REGISTRY[keyB];

    if (!defA || !defB) {
      // Nếu không nằm trong từ điển chuẩn thì chỉ tương thích nếu cùng tên
      return keyA === keyB;
    }

    return defA.type === defB.type;
  }

  /**
   * Quy đổi giá trị từ đơn vị nguồn sang đơn vị đích
   * @param value Giá trị số lượng
   * @param fromUnit Đơn vị nguồn (vd: 'kg', 'lít')
   * @param toUnit Đơn vị đích (vd: 'g', 'ml')
   * @returns Số lượng sau khi quy đổi theo đơn vị đích
   */
  static convert(value: number, fromUnit: string, toUnit: string): number {
    const keyFrom = this.normalizeUnit(fromUnit);
    const keyTo = this.normalizeUnit(toUnit);

    if (keyFrom === keyTo) {
      return value;
    }

    const defFrom = this.UNIT_REGISTRY[keyFrom];
    const defTo = this.UNIT_REGISTRY[keyTo];

    if (!defFrom || !defTo) {
      if (keyFrom !== keyTo) {
        throw new BadRequestException(
          `Không thể quy đổi giữa đơn vị "${fromUnit}" và "${toUnit}" (chưa được định nghĩa trong hệ thống quy đổi)`,
        );
      }
      return value;
    }

    if (defFrom.type !== defTo.type) {
      const typeNames: Record<UnitType, string> = {
        MASS: 'Khối lượng (g, kg)',
        VOLUME: 'Thể tích (ml, lít)',
        COUNT: 'Số lượng / Đếm (cái, chiếc)',
      };
      throw new BadRequestException(
        `Không thể quy đổi giữa hai hệ đơn vị khác nhau: "${fromUnit}" (${typeNames[defFrom.type]}) và "${toUnit}" (${typeNames[defTo.type]})`,
      );
    }

    // Giá trị chuẩn theo baseUnit = value * defFrom.factor
    // Giá trị theo toUnit = (value * defFrom.factor) / defTo.factor
    const baseValue = value * defFrom.factor;
    return baseValue / defTo.factor;
  }
}

