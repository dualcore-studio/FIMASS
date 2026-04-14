import type {
  RoleTabCounts,
  UsersListRoleFilter,
  UsersRoleCountKey,
} from '../../utils/usersListQuery';

const TABS: { role: UsersListRoleFilter; label: string; countKey: UsersRoleCountKey }[] = [
  { role: '', label: 'Tutti', countKey: 'tutti' },
  { role: 'admin', label: 'Admin', countKey: 'admin' },
  { role: 'supervisore', label: 'Supervisore', countKey: 'supervisore' },
  { role: 'struttura', label: 'Struttura', countKey: 'struttura' },
  { role: 'operatore', label: 'Operatore', countKey: 'operatore' },
  { role: 'fornitore', label: 'Fornitore', countKey: 'fornitore' },
];

interface UsersRoleFilterTabsProps {
  activeRole: UsersListRoleFilter;
  onRoleChange: (role: UsersListRoleFilter) => void;
  counts?: RoleTabCounts;
}

export default function UsersRoleFilterTabs({
  activeRole,
  onRoleChange,
  counts,
}: UsersRoleFilterTabsProps) {
  return (
    <div className="min-w-0">
      <div className="-mx-1 flex min-w-0 flex-wrap items-center gap-2 sm:flex-nowrap sm:overflow-x-auto sm:pb-1 sm:[scrollbar-width:thin]">
        <div
          className="inline-flex min-w-0 flex-wrap items-center gap-1 rounded-xl border border-slate-200/90 bg-slate-100/90 p-1 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] sm:flex-nowrap sm:justify-start"
          role="tablist"
          aria-label="Filtra utenti per ruolo"
        >
          {TABS.map(({ role, label, countKey }) => {
            const isActive = activeRole === role;
            const n = counts?.[countKey];
            const labelWithCount = n == null ? label : `${label} (${n})`;
            return (
              <button
                key={role || 'tutti'}
                type="button"
                role="tab"
                aria-selected={isActive}
                id={`users-role-tab-${role || 'tutti'}`}
                onClick={() => onRoleChange(role)}
                className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 ${
                  isActive
                    ? 'bg-white text-blue-800 shadow-sm ring-1 ring-slate-200/80'
                    : 'text-slate-600 hover:bg-white/75 hover:text-slate-900 active:bg-white/90'
                }`}
              >
                <span className="whitespace-nowrap tabular-nums">{labelWithCount}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
