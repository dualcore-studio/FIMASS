import { getQuoteStatusColor, getPolicyStatusColor, getAppointmentStatusColor } from '../../utils/helpers';

interface StatusBadgeProps {
  stato: string;
  type?: 'quote' | 'policy' | 'appointment';
}

export default function StatusBadge({ stato, type = 'quote' }: StatusBadgeProps) {
  const colorClass =
    type === 'policy'
      ? getPolicyStatusColor(stato)
      : type === 'appointment'
        ? getAppointmentStatusColor(stato)
        : getQuoteStatusColor(stato);
  return <span className={`badge ${colorClass}`}>{stato}</span>;
}
