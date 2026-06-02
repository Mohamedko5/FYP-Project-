import Card from '../components/ui/Card.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import Table from '../components/ui/Table.jsx';
import { products, formatCurrency } from '../data/dummyData.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function Products() {
  const { t } = useLanguage();
  const columns = [
    { key: 'name', label: t('common.productName') },
    { key: 'category', label: t('common.category') },
    { key: 'unit', label: t('common.unit') },
    { key: 'price', label: t('common.price'), render: (row) => formatCurrency(row.price) },
    { key: 'stock', label: t('common.currentStock') },
    { key: 'status', label: t('common.status'), render: (row) => <StatusBadge status={row.status} /> },
  ];

  return (
    <div className="page-grid">
      <Card title={t('products.title')} subtitle={t('products.subtitle')}>
        <Table columns={columns} rows={products} />
      </Card>
    </div>
  );
}
