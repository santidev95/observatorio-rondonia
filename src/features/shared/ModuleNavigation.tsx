import Link from "next/link";
export function ModuleNavigation({ active }: { active: "obras" | "receitas" }) {
  return (
    <nav className="module-navigation" aria-label="Módulos de Porto Velho">
      <Link href="/porto-velho" prefetch={false}>
        ← Porto Velho
      </Link>
      {["contratos", "obras", "receitas"].map((id) => (
        <Link
          key={id}
          href={"/porto-velho/" + id}
          aria-current={id === active ? "page" : undefined}
          prefetch={false}
        >
          {id[0].toUpperCase() + id.slice(1)}
        </Link>
      ))}
    </nav>
  );
}
