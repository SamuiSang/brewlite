import { BadRequestException } from '@nestjs/common';
import {
  OrderStateMachine,
  OrderStatus,
  ALL_ORDER_STATUSES,
} from './order-state-machine';

describe('OrderStateMachine (Task 10 - Core Logic)', () => {
  describe('isValidStatus', () => {
    it('should return true for all defined OrderStatuses', () => {
      ALL_ORDER_STATUSES.forEach((status) => {
        expect(OrderStateMachine.isValidStatus(status)).toBe(true);
        expect(OrderStateMachine.isValidStatus(status.toLowerCase())).toBe(true);
      });
    });

    it('should return false for invalid statuses', () => {
      expect(OrderStateMachine.isValidStatus('UNKNOWN')).toBe(false);
      expect(OrderStateMachine.isValidStatus('SHIPPED')).toBe(false);
      expect(OrderStateMachine.isValidStatus('')).toBe(false);
    });
  });

  describe('canTransition & validateTransition', () => {
    it('should allow valid happy path: PENDING -> PAID -> PREPARING -> READY -> COMPLETED', () => {
      expect(OrderStateMachine.canTransition('PENDING', 'PAID')).toBe(true);
      expect(OrderStateMachine.canTransition('PAID', 'PREPARING')).toBe(true);
      expect(OrderStateMachine.canTransition('PREPARING', 'READY')).toBe(true);
      expect(OrderStateMachine.canTransition('READY', 'COMPLETED')).toBe(true);

      expect(() =>
        OrderStateMachine.validateTransition('PENDING', 'PAID'),
      ).not.toThrow();
      expect(() =>
        OrderStateMachine.validateTransition('PAID', 'PREPARING'),
      ).not.toThrow();
      expect(() =>
        OrderStateMachine.validateTransition('PREPARING', 'READY'),
      ).not.toThrow();
      expect(() =>
        OrderStateMachine.validateTransition('READY', 'COMPLETED'),
      ).not.toThrow();
    });

    it('should allow payment failure branch: PENDING -> PAYMENT_FAILED and retry PAYMENT_FAILED -> PAID', () => {
      expect(OrderStateMachine.canTransition('PENDING', 'PAYMENT_FAILED')).toBe(
        true,
      );
      expect(OrderStateMachine.canTransition('PAYMENT_FAILED', 'PAID')).toBe(
        true,
      );
      expect(() =>
        OrderStateMachine.validateTransition('PENDING', 'PAYMENT_FAILED'),
      ).not.toThrow();
      expect(() =>
        OrderStateMachine.validateTransition('PAYMENT_FAILED', 'PAID'),
      ).not.toThrow();
    });

    it('should allow cancellation from non-terminal states', () => {
      const cancellableStatuses: OrderStatus[] = [
        'PENDING',
        'PAYMENT_FAILED',
        'PAID',
        'PREPARING',
        'READY',
      ];

      cancellableStatuses.forEach((status) => {
        expect(OrderStateMachine.canTransition(status, 'CANCELLED')).toBe(true);
        expect(() =>
          OrderStateMachine.validateTransition(status, 'CANCELLED'),
        ).not.toThrow();
      });
    });

    it('should allow keeping the same status (idempotent status check)', () => {
      expect(OrderStateMachine.canTransition('PENDING', 'PENDING')).toBe(true);
      expect(OrderStateMachine.canTransition('PAID', 'PAID')).toBe(true);
      expect(() =>
        OrderStateMachine.validateTransition('PAID', 'PAID'),
      ).not.toThrow();
    });

    it('should reject invalid transition jumping ahead (e.g. PENDING -> COMPLETED)', () => {
      expect(OrderStateMachine.canTransition('PENDING', 'COMPLETED')).toBe(
        false,
      );
      expect(() =>
        OrderStateMachine.validateTransition('PENDING', 'COMPLETED'),
      ).toThrow(BadRequestException);
    });

    it('should reject transitions from terminal state COMPLETED', () => {
      expect(OrderStateMachine.canTransition('COMPLETED', 'CANCELLED')).toBe(
        false,
      );
      expect(OrderStateMachine.canTransition('COMPLETED', 'PENDING')).toBe(
        false,
      );

      expect(() =>
        OrderStateMachine.validateTransition('COMPLETED', 'CANCELLED'),
      ).toThrow(BadRequestException);
    });

    it('should reject transitions from terminal state CANCELLED', () => {
      expect(OrderStateMachine.canTransition('CANCELLED', 'PAID')).toBe(false);
      expect(OrderStateMachine.canTransition('CANCELLED', 'READY')).toBe(false);

      expect(() =>
        OrderStateMachine.validateTransition('CANCELLED', 'PAID'),
      ).toThrow(BadRequestException);
    });
  });

  describe('isTerminalStatus', () => {
    it('should correctly identify terminal states', () => {
      expect(OrderStateMachine.isTerminalStatus('COMPLETED')).toBe(true);
      expect(OrderStateMachine.isTerminalStatus('CANCELLED')).toBe(true);
      expect(OrderStateMachine.isTerminalStatus('PENDING')).toBe(false);
      expect(OrderStateMachine.isTerminalStatus('PAID')).toBe(false);
      expect(OrderStateMachine.isTerminalStatus('PREPARING')).toBe(false);
      expect(OrderStateMachine.isTerminalStatus('READY')).toBe(false);
    });
  });

  describe('getNextAllowedStatuses', () => {
    it('should return next allowed statuses list', () => {
      expect(OrderStateMachine.getNextAllowedStatuses('PENDING')).toEqual([
        'PAID',
        'PAYMENT_FAILED',
        'CANCELLED',
      ]);
      expect(OrderStateMachine.getNextAllowedStatuses('PAID')).toEqual([
        'PREPARING',
        'CANCELLED',
      ]);
      expect(OrderStateMachine.getNextAllowedStatuses('COMPLETED')).toEqual([]);
      expect(OrderStateMachine.getNextAllowedStatuses('CANCELLED')).toEqual([]);
    });
  });
});
