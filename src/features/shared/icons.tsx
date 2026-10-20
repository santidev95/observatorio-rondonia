type Props = { size?: number; className?: string };
function Icon({
  size = 20,
  className,
  kind,
}: {
  size?: number;
  className?: string;
  kind: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === "search" ? (
        <>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </>
      ) : kind === "close" ? (
        <path d="m18 6-12 12M6 6l12 12" />
      ) : kind === "download" ? (
        <path d="M21 15v4H3v-4M7 10l5 5 5-5M12 15V3" />
      ) : kind === "arrow" ? (
        <path d="M7 17 17 7M7 7h10v10" />
      ) : (
        <>
          <path d="M14 2H6v20h12V6z" />
          <circle cx="11" cy="13" r="3" />
          <path d="m13 15 3 3" />
        </>
      )}
    </svg>
  );
}
export const Search = (p: Props) => <Icon {...p} kind="search" />;
export const X = (p: Props) => <Icon {...p} kind="close" />;
export const FileSearch = (p: Props) => <Icon {...p} kind="file" />;
export const Download = (p: Props) => <Icon {...p} kind="download" />;
export const ArrowUpRight = (p: Props) => <Icon {...p} kind="arrow" />;
