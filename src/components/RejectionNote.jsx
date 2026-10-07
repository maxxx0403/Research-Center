/**
 * Small "View reason" button shown under a Rejected status badge.
 * Clicking it opens the conversation panel, which shows the full
 * rejection reason at the top.
 *
 * @param {string[]} reasons  distinct rejection reasons for the request
 * @param {() => void} [onOpen]
 */
const RejectionNote = ({ reasons = [], onOpen }) => {
  if (!reasons.length) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="mt-2 flex w-fit items-center rounded-full border border-destructive/25 bg-destructive/5 hover:bg-destructive/10 transition-colors px-3 py-1.5 text-xs font-semibold text-destructive cursor-pointer"
    >
      View reason
    </button>
  );
};

export default RejectionNote;