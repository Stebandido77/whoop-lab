import type { Insufficient } from '@/lib/econ';
import { f0 } from '@/lib/format';
import { useMessages } from '@/lib/i18n';

/**
 * What a panel shows instead of an estimate it cannot support.
 *
 * The count is the point. «Sin datos suficientes» tells a reader nothing about
 * whether to come back next week or next year; «faltan 91 días» tells them
 * exactly, and it makes visible that the panel switched itself off on purpose
 * rather than breaking.
 */
export function NotEnough({ state, what }: { state: Insufficient; what?: string }) {
  const m = useMessages();
  return (
    <p className="empty">
      {m.common.notEnough(
        f0(state.missing),
        f0(state.n),
        f0(state.minN),
        what ?? m.common.thisModel,
      )}
    </p>
  );
}
