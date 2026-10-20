export function Status({ value }: { value: string }) {
  const style = /finalizada|concluída/i.test(value)
    ? "finished"
    : /andamento/i.test(value)
      ? "running"
      : /rescis/i.test(value)
        ? "closed"
        : "unknown";
  return (
    <span className={`status ${style}`}>
      <span />
      {value}
    </span>
  );
}
