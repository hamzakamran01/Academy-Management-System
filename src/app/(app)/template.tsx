/** Re-mounts on every navigation, so each screen eases in (≈280 ms, skipped under reduced motion). */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
