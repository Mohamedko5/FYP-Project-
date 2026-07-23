import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppWindow from '../components/ui/AppWindow.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import { getWarehouses } from '../services/inventoryApi.js';
import {
  approveSupplyOffer,
  counterSupplyOffer,
  getAdminSupplyOffer,
  getAdminSupplyOffers,
  recordSupplyOfferPayment,
  recordSupplyOfferReceipt,
  rejectSupplyOffer,
  selectSupplyOfferWarehouse,
  startSupplyOfferReview,
} from '../services/supplyOffersApi.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const filters = ['', 'submitted', 'under_review', 'counter_offered', 'customer_accepted', 'approved', 'paid', 'awaiting_receipt', 'received', 'completed', 'rejected'];

function money(value, currency = 'SDG') {
  return `${currency} ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function SupplyOffers() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState(null);

  const activeOffer = useMemo(() => selected || rows[0] || null, [selected, rows]);

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await getAdminSupplyOffers({ search, status, page_size: 50 });
      const resultRows = response.results || [];
      setRows(resultRows);
      setSelected((current) => current ? resultRows.find((row) => row.id === current.id) || current : resultRows[0] || null);
    } catch {
      setError(t('supplyOffers.loadError'));
    } finally {
      setLoading(false);
    }
  }, [search, status, t]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    getWarehouses({ is_active: true }).then((response) => setWarehouses(response.results || response || [])).catch(() => setWarehouses([]));
  }, []);

  async function refreshDetail(id = activeOffer?.id) {
    if (!id) return;
    const detail = await getAdminSupplyOffer(id);
    setSelected(detail);
    await load();
  }

  function openCustomer(offer) {
    if (offer?.customer_code) navigate(`/customers?search=${encodeURIComponent(offer.customer_code)}`);
  }

  return (
    <div className="page-grid supply-offers-page">
      <Card title={t('supplyOffers.title')} subtitle={t('supplyOffers.subtitle')}>
        <div className="toolbar-row supply-offers-toolbar">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('supplyOffers.searchPlaceholder')} />
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {filters.map((value) => <option key={value || 'all'} value={value}>{value ? t(`supplyOffers.statuses.${value}`) : t('supplyOffers.all')}</option>)}
          </select>
          <Button type="button" variant="secondary" onClick={load}>{t('retry')}</Button>
        </div>
        {error && <div className="form-error"><p>{error}</p></div>}
        <div className="table-wrap supply-offers-table">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('supplyOffers.offerNumber')}</th>
                <th>{t('common.customer')}</th>
                <th>{t('common.product')}</th>
                <th>{t('common.location')}</th>
                <th>{t('supplyOffers.proposedTotal')}</th>
                <th>{t('common.status')}</th>
                <th>{t('common.action')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="table-empty">{t('supplyOffers.loading')}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="7" className="table-empty">{t('supplyOffers.empty')}</td></tr>
              ) : rows.map((offer) => (
                <tr key={offer.id}>
                  <td>{offer.offer_number}</td>
                  <td>{offer.customer_name}<br /><span className="code-text">{offer.customer_code}</span></td>
                  <td>{offer.product_summary}</td>
                  <td>{offer.city}, {offer.region}</td>
                  <td>{money(offer.proposed_total, offer.currency)}</td>
                  <td><StatusBadge status={t(`supplyOffers.statuses.${offer.status}`)} /></td>
                  <td><Button type="button" variant="secondary" onClick={() => refreshDetail(offer.id)}>{t('view')}</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {activeOffer && (
        <Card title={`${activeOffer.offer_number} - ${activeOffer.customer_name}`} subtitle={activeOffer.customer_safe_admin_message || t('supplyOffers.detailSubtitle')}>
          <div className="offer-detail-grid">
            <section>
              <h3>{t('supplyOffers.customerSection')}</h3>
              <p>{activeOffer.customer_name} <span className="code-text">{activeOffer.customer_code}</span></p>
              <p>{activeOffer.customer_phone}</p>
              <Button type="button" variant="secondary" onClick={() => openCustomer(activeOffer)}>{t('chat.viewCustomerProfile')}</Button>
            </section>
            <section>
              <h3>{t('supplyOffers.location')}</h3>
              <p>{activeOffer.region}, {activeOffer.city}, {activeOffer.area}</p>
              <p>{activeOffer.detailed_address}</p>
            </section>
          </div>
          <div className="table-wrap supply-offers-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('common.product')}</th>
                  <th>{t('common.unit')}</th>
                  <th>{t('common.quantity')}</th>
                  <th>{t('supplyOffers.customerPrice')}</th>
                  <th>{t('supplyOffers.adminPrice')}</th>
                  <th>{t('supplyOffers.agreedPrice')}</th>
                  <th>{t('supplyOffers.quality')}</th>
                </tr>
              </thead>
              <tbody>
                {(activeOffer.items || []).map((item) => (
                  <tr key={item.id}>
                    <td>{item.product_name_snapshot}</td>
                    <td>{item.unit_snapshot}</td>
                    <td>{item.quantity}</td>
                    <td>{money(item.customer_proposed_unit_price)}</td>
                    <td>{item.admin_proposed_unit_price ? money(item.admin_proposed_unit_price) : '-'}</td>
                    <td>{item.agreed_unit_price ? money(item.agreed_unit_price) : '-'}</td>
                    <td>{item.quality_grade || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="button-row">
            {activeOffer.status === 'submitted' && <Button type="button" onClick={() => setAction('review')}>{t('supplyOffers.startReview')}</Button>}
            {['submitted', 'under_review', 'counter_offered', 'customer_declined'].includes(activeOffer.status) && <Button type="button" variant="secondary" onClick={() => setAction('counter')}>{t('supplyOffers.counterOffer')}</Button>}
            {activeOffer.status === 'customer_accepted' && <Button type="button" onClick={() => setAction('approve')}>{t('supplyOffers.approve')}</Button>}
            {['submitted', 'under_review', 'customer_declined'].includes(activeOffer.status) && <Button type="button" variant="danger" onClick={() => setAction('reject')}>{t('supplyOffers.reject')}</Button>}
            {['approved', 'paid', 'awaiting_receipt'].includes(activeOffer.status) && <Button type="button" onClick={() => setAction('receipt')}>{t('supplyOffers.recordReceipt')}</Button>}
            {['approved', 'awaiting_receipt'].includes(activeOffer.status) && activeOffer.payment_status !== 'paid' && <Button type="button" onClick={() => setAction('payment')}>{t('supplyOffers.recordPayment')}</Button>}
            <Button type="button" variant="secondary" onClick={() => navigate(`/customer-messages?customer=${activeOffer.customer_code}`)}>{t('supplyOffers.chatWithCustomer')}</Button>
          </div>
        </Card>
      )}

      <OfferActionWindow
        action={action}
        offer={activeOffer}
        warehouses={warehouses}
        onClose={() => setAction(null)}
        onDone={() => { setAction(null); refreshDetail(activeOffer?.id); }}
      />
    </div>
  );
}

function OfferActionWindow({ action, offer, warehouses, onClose, onDone }) {
  const { t } = useLanguage();
  const [message, setMessage] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [electronicReference, setElectronicReference] = useState('');
  const [payingBank, setPayingBank] = useState('');
  const [cardLastFour, setCardLastFour] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentReceipt, setPaymentReceipt] = useState(null);
  const [prices, setPrices] = useState({});
  const [quantities, setQuantities] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  if (!action || !offer) return null;

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (action === 'review') await startSupplyOfferReview(offer.id);
      if (action === 'approve') {
        await approveSupplyOffer(offer.id, { customer_safe_message: message, receiving_warehouse_id: warehouseId || null });
        if (warehouseId) await selectSupplyOfferWarehouse(offer.id, { receiving_warehouse_id: warehouseId });
      }
      if (action === 'counter') {
        await counterSupplyOffer(offer.id, {
          message,
          items: offer.items.map((item) => ({
            offer_item_id: item.id,
            admin_proposed_quantity: quantities[item.id] || item.quantity,
            admin_proposed_unit_price: prices[item.id] || item.customer_proposed_unit_price,
          })),
        });
      }
      if (action === 'reject') await rejectSupplyOffer(offer.id, { rejection_reason: reason });
      if (action === 'receipt') {
        await recordSupplyOfferReceipt(offer.id, {
          receiving_warehouse_id: warehouseId || offer.receiving_warehouse,
          items: offer.items.map((item) => ({ offer_item_id: item.id, accepted_quantity: quantities[item.id] || item.quantity, rejected_quantity: '0' })),
        });
      }
      if (action === 'payment') {
        if (paymentMethod !== 'cash') {
          const formData = new FormData();
          formData.append('amount', amount);
          formData.append('payment_method', paymentMethod);
          formData.append('payment_date', paymentDate);
          formData.append('transaction_reference', electronicReference);
          formData.append('paying_bank', payingBank);
          formData.append('card_last_four', cardLastFour);
          formData.append('description', message);
          if (paymentReceipt) formData.append('payment_receipt', paymentReceipt);
          await recordSupplyOfferPayment(offer.id, formData);
        } else {
          await recordSupplyOfferPayment(offer.id, { amount, payment_method: paymentMethod, payment_date: paymentDate, description: message });
        }
      }
      onDone();
    } catch (err) {
      setError(err.message || t('common.requestFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppWindow id="supply-offer-action" title={t(`supplyOffers.actions.${action}`)} description={offer.offer_number} isOpen onClose={onClose} isDirty={Boolean(message || reason || amount)} isSubmitting={saving}>
      <form className="stacked-form" onSubmit={submit}>
        {error && <div className="form-error"><p>{error}</p></div>}
        {['approve', 'receipt'].includes(action) && (
          <label>{t('supplyOffers.receivingWarehouse')}
            <select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} required>
              <option value="">{t('supplyOffers.selectWarehouse')}</option>
              {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.warehouse_name}</option>)}
            </select>
          </label>
        )}
        {action === 'counter' && (offer.items || []).map((item) => (
          <div key={item.id} className="form-grid two-columns">
            <label>{item.product_name_snapshot} - {item.unit_snapshot}
              <input value={quantities[item.id] || ''} onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: event.target.value }))} placeholder={item.quantity} required />
            </label>
            <label>{t('supplyOffers.adminPrice')}
              <input value={prices[item.id] || ''} onChange={(event) => setPrices((current) => ({ ...current, [item.id]: event.target.value }))} placeholder={item.customer_proposed_unit_price} required />
            </label>
          </div>
        ))}
        {action === 'receipt' && (offer.items || []).map((item) => (
          <label key={item.id}>{item.product_name_snapshot} - {t('supplyOffers.acceptedQuantity')}
            <input value={quantities[item.id] || item.quantity} onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: event.target.value }))} required />
          </label>
        ))}
        {action === 'reject' && <label>{t('supplyOffers.rejectionReason')}<textarea value={reason} onChange={(event) => setReason(event.target.value)} required /></label>}
        {action === 'payment' && (
          <>
            <label>{t('common.amount')}<input value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
            <label>{t('common.date')}<input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} required /></label>
            <label>{t('journal.paymentMethod')}<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
              <option value="cash">{t('journal.paymentMethods.cash')}</option>
              <option value="bank_of_khartoum">{t('supplyOffers.bankOfKhartoum')}</option>
              <option value="visa">{t('supplyOffers.visa')}</option>
              <option value="mastercard">{t('supplyOffers.mastercard')}</option>
            </select></label>
            {paymentMethod !== 'cash' && (
              <>
                <label>{t('journal.electronicReference')}<input value={electronicReference} onChange={(event) => setElectronicReference(event.target.value)} required /></label>
                {paymentMethod === 'bank_of_khartoum' && <label>{t('supplyOffers.payingBank')}<input value={payingBank} onChange={(event) => setPayingBank(event.target.value)} /></label>}
                {['visa', 'mastercard'].includes(paymentMethod) && <label>{t('supplyOffers.lastFourDigits')}<input value={cardLastFour} onChange={(event) => setCardLastFour(event.target.value)} maxLength="4" inputMode="numeric" /></label>}
                <label className="localized-file-input">
                  <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setPaymentReceipt(event.target.files?.[0] || null)} required />
                  <span className="localized-file-input__button">{t('journal.chooseReceiptImage')}</span>
                  <span className="localized-file-input__name">{paymentReceipt?.name || t('journal.noReceiptSelected')}</span>
                </label>
              </>
            )}
          </>
        )}
        {['approve', 'counter', 'payment'].includes(action) && <label>{t('common.note')}<textarea value={message} onChange={(event) => setMessage(event.target.value)} /></label>}
        <div className="app-window__footer">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>{t('cancel')}</Button>
          <Button type="submit" disabled={saving}>{saving ? t('journal.saving') : t('save')}</Button>
        </div>
      </form>
    </AppWindow>
  );
}
