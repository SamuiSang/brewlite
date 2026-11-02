import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

export interface VnpayPaymentUrlParams {
  orderId: string;
  orderCode: string;
  amount: number;
  ipAddr?: string;
  bankCode?: string;
  language?: string;
  returnUrl?: string;
}

@Injectable()
export class VnpayService {
  private readonly tmnCode: string =
    process.env.VNP_TMN_CODE || '8VXIB1MM';
  private readonly hashSecret: string =
    process.env.VNP_HASH_SECRET || 'GJZGJZTKHBYBESRSLCLSPZXGFPEXVPGF';
  private readonly vnpUrl: string =
    process.env.VNP_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
  private readonly returnUrl: string =
    process.env.VNP_RETURN_URL || 'http://localhost:3001/payments/vnpay/return';

  /**
   * Định dạng ngày giờ GMT+7 theo chuẩn VNPAY: yyyyMMddHHmmss
   */
  formatVnpayDate(date: Date = new Date()): string {
    const vnTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    const yyyy = vnTime.getUTCFullYear();
    const MM = String(vnTime.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(vnTime.getUTCDate()).padStart(2, '0');
    const HH = String(vnTime.getUTCHours()).padStart(2, '0');
    const mm = String(vnTime.getUTCMinutes()).padStart(2, '0');
    const ss = String(vnTime.getUTCSeconds()).padStart(2, '0');
    return `${yyyy}${MM}${dd}${HH}${mm}${ss}`;
  }

  /**
   * Sắp xếp các tham số theo bảng chữ cái và encode chuẩn VNPAY
   */
  sortObject(obj: Record<string, any>): Record<string, string> {
    const sorted: Record<string, string> = {};
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
        sorted[key] = encodeURIComponent(String(obj[key])).replace(/%20/g, '+');
      }
    }
    return sorted;
  }

  /**
   * Tạo URL thanh toán VNPAY Sandbox kèm chữ ký số HMAC-SHA512
   */
  buildPaymentUrl(params: VnpayPaymentUrlParams): string {
    const createDate = this.formatVnpayDate(new Date());
    const amountInVnpayFormat = Math.round(params.amount * 100);

    const vnpParams: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: this.tmnCode,
      vnp_Locale: params.language || 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: params.orderId,
      vnp_OrderInfo: `Thanh toan don hang ${params.orderCode}`,
      vnp_OrderType: 'other',
      vnp_Amount: String(amountInVnpayFormat),
      vnp_ReturnUrl: params.returnUrl || this.returnUrl,
      vnp_IpAddr: params.ipAddr && params.ipAddr !== '::1' ? params.ipAddr : '127.0.0.1',
      vnp_CreateDate: createDate,
    };

    if (params.bankCode) {
      vnpParams['vnp_BankCode'] = params.bankCode;
    }

    const sortedParams = this.sortObject(vnpParams);
    const signData = Object.keys(sortedParams)
      .map((k) => `${k}=${sortedParams[k]}`)
      .join('&');

    const hmac = crypto.createHmac('sha512', this.hashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    return `${this.vnpUrl}?${signData}&vnp_SecureHash=${signed}`;
  }

  /**
   * Xác thực chữ ký số HMAC-SHA512 từ callback của VNPAY (IPN hoặc Return URL)
   */
  verifyChecksum(query: Record<string, any>): boolean {
    const vnpParams: Record<string, string> = {};
    let secureHash = '';

    for (const key of Object.keys(query)) {
      if (key === 'vnp_SecureHash') {
        secureHash = String(query[key]);
      } else if (key.startsWith('vnp_') && key !== 'vnp_SecureHashType') {
        vnpParams[key] = String(query[key]);
      }
    }

    if (!secureHash) {
      return false;
    }

    const sorted = this.sortObject(vnpParams);
    const signData = Object.keys(sorted)
      .map((k) => `${k}=${sorted[k]}`)
      .join('&');

    const hmac = crypto.createHmac('sha512', this.hashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    return secureHash.toLowerCase() === signed.toLowerCase();
  }

  /**
   * Lấy thông tin cấu hình công khai của cổng thanh toán VNPAY Sandbox
   */
  getPublicConfig() {
    return {
      tmnCode: this.tmnCode,
      vnpUrl: this.vnpUrl,
      returnUrl: this.returnUrl,
      sandboxCardDemo: {
        bank: 'NCB',
        cardNumber: '9704198526191432198',
        cardHolder: 'NGUYEN VAN A',
        issueDate: '07/15',
        otp: '123456',
      },
    };
  }
}
