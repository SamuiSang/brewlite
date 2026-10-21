import { BadRequestException } from '@nestjs/common';

/**
 * Danh sách trạng thái đơn hàng trong hệ thống BrewLite
 */
export type OrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'PAYMENT_FAILED'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED';

export const ALL_ORDER_STATUSES: OrderStatus[] = [
  'PENDING',
  'PAID',
  'PAYMENT_FAILED',
  'PREPARING',
  'READY',
  'COMPLETED',
  'CANCELLED',
];

/**
 * Ma trận chuyển đổi trạng thái hợp lệ (Order State Machine Transition Matrix)
 *
 * Flow chuẩn:
 * PENDING -> PAID -> PREPARING -> READY -> COMPLETED
 *
 * Nhánh ngoại lệ:
 * PENDING -> PAYMENT_FAILED (khách thanh toán lỗi) -> PAID (thanh toán lại thành công)
 * PENDING / PAYMENT_FAILED / PAID / PREPARING / READY -> CANCELLED (hủy đơn)
 * COMPLETED và CANCELLED là Terminal States (không thể chuyển tiếp).
 */
export const ORDER_STATE_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['PAID', 'PAYMENT_FAILED', 'CANCELLED'],
  PAYMENT_FAILED: ['PAID', 'CANCELLED'],
  PAID: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [], // Trạng thái kết thúc
  CANCELLED: [], // Trạng thái kết thúc
};

export class OrderStateMachine {
  /**
   * Kiểm tra một chuỗi có phải OrderStatus hợp lệ hay không
   */
  static isValidStatus(status: string): status is OrderStatus {
    return ALL_ORDER_STATUSES.includes(status.toUpperCase() as OrderStatus);
  }

  /**
   * Kiểm tra xem việc chuyển từ currentStatus sang nextStatus có hợp lệ không
   */
  static canTransition(
    currentStatus: OrderStatus,
    nextStatus: OrderStatus,
  ): boolean {
    if (currentStatus === nextStatus) {
      return true; // Giữ nguyên trạng thái coi như hợp lệ
    }
    const allowed = ORDER_STATE_TRANSITIONS[currentStatus] || [];
    return allowed.includes(nextStatus);
  }

  /**
   * Xác thực chuyển đổi trạng thái. Nếu không hợp lệ sẽ ném ngoại lệ BadRequestException
   */
  static validateTransition(
    currentStatus: OrderStatus,
    nextStatus: OrderStatus,
  ): void {
    if (currentStatus === nextStatus) {
      return;
    }

    if (this.isTerminalStatus(currentStatus)) {
      throw new BadRequestException(
        `Đơn hàng đã ở trạng thái kết thúc "${currentStatus}", không thể thay đổi trạng thái sang "${nextStatus}".`,
      );
    }

    const allowed = ORDER_STATE_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(nextStatus)) {
      const allowedText =
        allowed.length > 0 ? allowed.join(', ') : 'Không có (trạng thái đóng)';
      throw new BadRequestException(
        `Không thể chuyển trạng thái đơn hàng từ "${currentStatus}" sang "${nextStatus}". Các trạng thái hợp lệ tiếp theo: [${allowedText}].`,
      );
    }
  }

  /**
   * Lấy danh sách các trạng thái hợp lệ tiếp theo có thể chuyển tới
   */
  static getNextAllowedStatuses(currentStatus: OrderStatus): OrderStatus[] {
    return ORDER_STATE_TRANSITIONS[currentStatus] || [];
  }

  /**
   * Kiểm tra trạng thái kết thúc (Terminal State)
   */
  static isTerminalStatus(status: OrderStatus): boolean {
    return status === 'COMPLETED' || status === 'CANCELLED';
  }
}
