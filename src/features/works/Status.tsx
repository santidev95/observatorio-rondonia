import { Badge } from "@mantine/core";

export function Status({ value }: { value: string }) {
  const color = /finalizada|concluída/i.test(value)
    ? "green"
    : /andamento/i.test(value)
      ? "brand"
      : /rescis/i.test(value)
        ? "red"
        : "gray";
  return (
    <Badge
      className="work-status"
      color={color}
      variant="light"
      leftSection={<span className="work-status-dot" aria-hidden="true" />}
    >
      {value}
    </Badge>
  );
}
