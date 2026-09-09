import React from 'react';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import { ICreditCard, ICardDisplayProps } from '../models/ICreditCard';
import styles from './CreditCardDisplay.scss';

/**
 * Reusable Credit Card Display Component
 * Renders card information with optional icon, expiry, and funding type
 */
const CreditCardDisplay: React.FC<ICardDisplayProps> = ({
  card,
  showIcon = true,
  showExpiry = true,
  showFunding = false,
  compact = false,
}) => {
  if (!card) return null;

  if (compact) {
    return (
      <div className='credit-card--compact'>
        {showIcon && <UiIcon icon={card.brand} />}
        <span className='credit-card__brand'>{card.brand?.toUpperCase?.()} •••• {card.last4}</span>
      </div>
    );
  }

  return (
    <div className='credit-card'>
      <div className='credit-card__icon-wrapper'>
        {showIcon && (
          <div className='credit-card__icon'>
            <UiIcon icon={card.brand} />
          </div>
        )}
      </div>

      <div className='credit-card__info'>
        <div className='credit-card__brand'>
          {card.brand?.toUpperCase?.()} Card
        </div>

        <div className='credit-card__number'>
          •••• •••• •••• {card.last4}
        </div>

        <div className='credit-card__meta'>
          {showExpiry && card.exp_month && card.exp_year && (
            <span className='credit-card__expiry'>
              Expires {card.exp_month}/{card.exp_year}
            </span>
          )}

          {showFunding && card.funding && (
            <span className='credit-card__funding'>
              {card.funding?.charAt(0).toUpperCase() + card.funding?.slice(1)} Card
            </span>
          )}

          {card.country && (
            <span className='credit-card__country'>
              {card.country}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreditCardDisplay;
