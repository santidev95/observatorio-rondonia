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
      ) : kind === "works" ? (
        <>
          <path d="M3 21h18M5 21V9l7-6 7 6v12M9 21v-6h6v6M9 10h6" />
        </>
      ) : kind === "revenues" ? (
        <>
          <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
        </>
      ) : kind === "scales" ? (
        <>
          <path d="M12 3v17M7 21h10M4 7l8-3 8 3M4 7l-3 7h6zM20 7l-3 7h6z" />
          <path d="M1 14a3 3 0 0 0 6 0M17 14a3 3 0 0 0 6 0" />
        </>
      ) : kind === "github" ? (
        <>
          <path d="M9 19c-4.3 1.4-4.3-2.5-6-3M15 22v-3.9a3.4 3.4 0 0 0-.9-2.6c3-.3 6.1-1.4 6.1-6.7a5.2 5.2 0 0 0-1.4-3.6 4.8 4.8 0 0 0-.1-3.6S17.6 1.3 15 3a12.4 12.4 0 0 0-6 0C6.4 1.3 5.3 1.6 5.3 1.6a4.8 4.8 0 0 0-.1 3.6 5.2 5.2 0 0 0-1.4 3.6c0 5.3 3.1 6.4 6.1 6.7a3.4 3.4 0 0 0-.9 2.6V22" />
        </>
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
export const Works = (p: Props) => <Icon {...p} kind="works" />;
export const Revenues = (p: Props) => <Icon {...p} kind="revenues" />;
export const Scales = (p: Props) => <Icon {...p} kind="scales" />;
export const GitHub = (p: Props) => <Icon {...p} kind="github" />;
