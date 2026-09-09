// Relative Path: ./Payments.tsx
import React, { useState } from 'react';
import styles from './UserPayments.scss';
import creditCardStyles from '@webstack/components/CreditCard/views/CreditCardDisplay.scss';
import { dateFormat } from '@webstack/helpers/userExperienceFormats';
import { IEvent } from '@webstack/components/Calendar/models/IEvent';
import environment from '~/src/core/environment';
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import AdapTable from '@webstack/components/AdapTable/views/AdapTable';
import CreditCardDisplay from '@webstack/components/CreditCard/views/CreditCardDisplay';
import UserSubscriptions from '../views/UserSubscriptions';
import useUserPurchaseIntents from '~/src/core/services/MemberService/hooks/useUserPurchaseIntents';

// Remember to create a sibling SCSS file with the same name as this component

const UserPayments: React.FC<any> = () => {
    const today = dateFormat(new Date());
    const [events, setEvents] = useState<IEvent[] | undefined>(undefined);
    const { intents } = useUserPurchaseIntents();
    const [selectedIntent, setSelectedIntent] = useState<any | null>(null);

    const handleRowClick = (intent: any) => {
        setSelectedIntent(intent);
    };

    const handleCloseDetail = () => {
        setSelectedIntent(null);
    };

    const renderCell = (key: string, item: any) => {
        if (key === 'status') {
            return <span className={`payments__status payments__status--${item.status}`}>{item.status}</span>;
        }
        if (key === 'payment_method') {
            return (
                <CreditCardDisplay
                    card={{
                        brand: item.payment_method_icon || 'unknown',
                        last4: item.payment_method.split('•••• ')[1] || '0000',
                    }}
                    showIcon={true}
                    showExpiry={false}
                    showFunding={false}
                    compact={true}
                />
            );
        }
        return undefined;
    };

    // Transform data to flatten complex objects into renderable strings for AdapTable
    const tableData = intents?.map((pi: any) => ({
        id: pi.id,
        amount: pi.amount ? `$${(pi.amount / 100).toFixed(2)} ${pi.currency?.toUpperCase?.() || 'USD'}` : '—',
        status: pi.status,
        payment_method: pi.payment_method?.card ? `${pi.payment_method.card.brand?.toUpperCase?.()} •••• ${pi.payment_method.card.last4}` : '—',
        payment_method_icon: pi.payment_method?.card?.brand || '',
        created: pi.created ? new Date(pi.created * 1000).toLocaleString() : '—',
    })) || [];

    // Handler that looks up the original from intents by ID
    const handleTableRowClick = (row: any) => {
        const original = intents?.find(pi => pi.id === row.id);
        if (original) {
            handleRowClick(original);
        }
    };

    // If a payment intent is selected, show detail view
    if (selectedIntent) {
        return (
            <>
                <style jsx>{styles}</style>
                <style jsx>{creditCardStyles}</style>
                <div className='payments'>
                    <div className='payments__detail'>
                        <div className='payments__detail-header'>
                            <UiButton onClick={handleCloseDetail}>← Back to List</UiButton>
                        </div>

                        <div className='payments__detail-card'>
                            <div className='payments__detail-title'>
                                <UiIcon icon={`${environment.merchant.name}-logo`} />
                                <h4>Payment Intent Details</h4>
                            </div>
                            {/* {JSON.stringify(selectedIntent)}  */}
                            {/* Payment Summary Section */}
                            <div className='payments__detail-section'>
                                <h5>Transaction Summary</h5>
                            </div>

                            <div className='payments__detail-grid'>
                                <div className='payments__detail-item'>
                                    <span className='payments__detail-label'>Amount</span>
                                    <span className='payments__detail-value-large'>
                                        ${(selectedIntent.amount / 100).toFixed(2)}
                                    </span>
                                    <span className='payments__detail-currency'>
                                        {selectedIntent.currency?.toUpperCase?.() || 'USD'}
                                    </span>
                                </div>

                                <div className='payments__detail-item'>
                                    <span className='payments__detail-label'>Status</span>
                                    <span className={`payments__detail-status payments__detail-status--${selectedIntent.status}`}>
                                        {selectedIntent.status}
                                    </span>
                                </div>

                                <div className='payments__detail-item'>
                                    <span className='payments__detail-label'>Created</span>
                                    <span className='payments__detail-value'>
                                        {selectedIntent.created ? new Date(selectedIntent.created * 1000).toLocaleString() : '—'}
                                    </span>
                                </div>
                            </div>

                            {/* Payment Method Section */}
                            <div className='payments__detail-section'>
                                <h5>Payment Method</h5>
                            </div>

                            {selectedIntent.payment_method?.card && (
                                <CreditCardDisplay
                                    card={selectedIntent.payment_method.card}
                                    showIcon={true}
                                    showExpiry={true}
                                    showFunding={true}
                                />
                            )}

                            {/* Charge Details Section */}
                            {selectedIntent.latest_charge && (
                                <>
                                    <div className='payments__detail-section'>
                                        <h5>Charge Details</h5>
                                    </div>

                                    <div className='payments__detail-grid-two'>
                                        <div className='payments__detail-row'>
                                            <span className='payments__detail-label'>Charge ID:</span>
                                            <code className='payments__code'>{selectedIntent.latest_charge.id}</code>
                                        </div>

                                        {selectedIntent.latest_charge.outcome && (
                                            <div className='payments__detail-row'>
                                                <span className='payments__detail-label'>Outcome:</span>
                                                <span className='payments__detail-value'>
                                                    {selectedIntent.latest_charge.outcome.seller_message || selectedIntent.latest_charge.outcome.type}
                                                </span>
                                            </div>
                                        )}

                                        <div className='payments__detail-row'>
                                            <span className='payments__detail-label'>Amount Captured:</span>
                                            <span className='payments__detail-value'>
                                                ${(selectedIntent.latest_charge.amount_captured / 100).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Customer & Transaction IDs */}
                            <div className='payments__detail-section'>
                                <h5>Transaction Information</h5>
                            </div>

                            <div className='payments__detail-grid-two'>
                                <div className='payments__detail-row'>
                                    <span className='payments__detail-label'>Intent ID:</span>
                                    <code className='payments__code'>{selectedIntent.id}</code>
                                </div>

                                <div className='payments__detail-row'>
                                    <span className='payments__detail-label'>Customer Email:</span>
                                    <span className='payments__detail-value'>
                                        {selectedIntent.customer?.email || selectedIntent.customer?.id || '—'}
                                    </span>
                                </div>

                                {selectedIntent.invoice && (
                                    <div className='payments__detail-row'>
                                        <span className='payments__detail-label'>Invoice:</span>
                                        <code className='payments__code'>
                                            {typeof selectedIntent.invoice === 'string' ? selectedIntent.invoice : selectedIntent.invoice?.id}
                                        </code>
                                    </div>
                                )}
                            </div>

                            {/* Order/Metadata Section */}
                            {selectedIntent.metadata && Object.keys(selectedIntent.metadata).length > 0 && (
                                <>
                                    <div className='payments__detail-section'>
                                        <h5>Additional Information</h5>
                                    </div>

                                    <div className='payments__detail-grid-two'>
                                        {selectedIntent.metadata.order_id && (
                                            <div className='payments__detail-row'>
                                                <span className='payments__detail-label'>Order ID:</span>
                                                <code className='payments__code'>{selectedIntent.metadata.order_id}</code>
                                            </div>
                                        )}
                                        {selectedIntent.metadata.product_name && (
                                            <div className='payments__detail-row'>
                                                <span className='payments__detail-label'>Product:</span>
                                                <span className='payments__detail-value'>{selectedIntent.metadata.product_name}</span>
                                            </div>
                                        )}
                                        {selectedIntent.metadata.quantity && (
                                            <div className='payments__detail-row'>
                                                <span className='payments__detail-label'>Quantity:</span>
                                                <span className='payments__detail-value'>{selectedIntent.metadata.quantity}</span>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}

                            <div className='payments__detail-footer'>
                                <UiButton onClick={handleCloseDetail}>Close</UiButton>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        );
    }


    return (
        <>
            <style jsx>{styles}</style>
            <style jsx>{creditCardStyles}</style>
            <div className='payments'>
                <UserSubscriptions />
                <div className='payments__list'>
                    <div className='payments__list-header'>
                        <div className='payments__list-title'>
                            <UiIcon icon={`${environment.merchant.name}-logo`} />
                            <h4>Payment History</h4>
                        </div>
                    </div>

                    {intents === undefined && <div className='payments__state'>Loading payment history...</div>}
                    {intents && intents.length === 0 && <div className='payments__state'>No payment intents found for this customer.</div>}
                    {intents && intents.length > 0 && (
                        <AdapTable
                            data={tableData}
                            onRowClick={handleTableRowClick}
                            options={{
                                tableTitle: "Payment History",
                                hoverable: true,
                                renderCell,
                            }}
                            variant="mini"
                        />
                    )}
                </div>
            </div>
        </>
    );
};

export default UserPayments;

