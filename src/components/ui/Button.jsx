import { useLanguage } from '../../i18n/LanguageContext.jsx';
import Tooltip from './Tooltip.jsx';

function textFromChildren(children) {
  return typeof children === 'string' ? children : '';
}

function inferButtonTooltip(label, t) {
  const exactMatches = [
    [t('journal.addTransaction'), t('tooltips.addCashTransaction')],
    [t('customers.addCashTransaction'), t('tooltips.addCashTransaction')],
    [t('customers.addCommodityTransaction'), t('tooltips.addCommodityTransaction')],
    [t('customers.addNewCustomer'), t('tooltips.addNewCustomer')],
    [t('customers.addNewWorker'), t('tooltips.addNewWorker')],
    [t('warehouse.actionAddStock'), t('tooltips.addStock')],
    [t('warehouse.addStock'), t('tooltips.addStock')],
    [t('warehouse.actionWithdrawStock'), t('tooltips.withdrawStock')],
    [t('warehouse.withdrawStock'), t('tooltips.withdrawStock')],
    [t('customers.viewProfile'), t('tooltips.viewProfile')],
    [t('orders.viewOrder'), t('tooltips.viewProfile')],
    [t('journal.printPdf'), t('tooltips.printPdf')],
    [t('reports.printReport'), t('tooltips.printPdf')],
    [t('reports.exportPdf'), t('tooltips.printPdf')],
    [t('journal.saveTransaction'), t('tooltips.saveTransaction')],
    [t('journal.saveCommodityTransaction'), t('tooltips.saveTransaction')],
    [t('journal.saveChanges'), t('tooltips.saveTransaction')],
    [t('orders.saveOrder'), t('tooltips.saveTransaction')],
    [t('shipments.saveWeighing'), t('tooltips.saveTransaction')],
    [t('save'), t('tooltips.saveTransaction')],
    [t('edit'), t('tooltips.edit')],
    [t('delete'), t('tooltips.delete')],
    [t('cancel'), t('tooltips.cancel')],
    [t('approve'), t('tooltips.approve')],
    [t('orders.approveOrder'), t('tooltips.approve')],
    [t('shipments.approveShipment'), t('tooltips.approve')],
  ];

  return exactMatches.find(([buttonLabel]) => buttonLabel === label)?.[1] || (label ? `${t('tooltips.buttonAction')} ${label}` : '');
}

export default function Button({ children, type = 'button', variant = 'primary', onClick, tooltip, ...props }) {
  const { t } = useLanguage();
  const label = textFromChildren(children);
  const tooltipText = tooltip || inferButtonTooltip(label, t);

  return (
    <Tooltip content={tooltipText} className="tooltip--inline-flex">
      <button type={type} className={`button button--${variant}`} onClick={onClick} {...props}>
        {children}
      </button>
    </Tooltip>
  );
}
