export type CardBrand = 'unknown' | 'amex' | 'diners' | 'discover' | 'visa' | 'jcb' | 'mastercard' | 'eftpos_au' | 'unionpay';

export interface ICreditCard {
  brand: CardBrand;
  last4: string;
  exp_month?: number;
  exp_year?: number;
  country?: string;
  funding?: 'credit' | 'debit' | 'prepaid' | 'unknown';
}

export interface ICardDisplayProps {
  card: ICreditCard;
  showIcon?: boolean;
  showExpiry?: boolean;
  showFunding?: boolean;
  compact?: boolean;
}
