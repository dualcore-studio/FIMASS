import { getQuoteStatusColor, getPolicyStatusColor } from '../../utils/helpers';

interface StatusBadgeProps {
  stato: string;
  type?: 'quote' | 'policy';
}

export default function StatusBadge({ stato, type = 'quote' }: StatusBadgeProps) {
  const colorClass = type === 'policy' ? getPolicyStatusColor(stato) : getQuoteStatusColor(stato);
  return <span className={`badge ${colorClass}`}>{stato}</span>;
}
