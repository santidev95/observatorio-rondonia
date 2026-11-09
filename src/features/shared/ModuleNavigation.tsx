import Link from "next/link";
import { Button } from "@mantine/core";
import {
  dataMunicipality,
  isExpensesMunicipality,
  type DataMunicipality,
} from "@/core/municipal-sources";
import styles from "./ModuleNavigation.module.css";
export function ModuleNavigation({
  active,
  municipality = "porto-velho",
}: {
  active: "contratos" | "obras" | "receitas" | "despesas";
  municipality?: DataMunicipality;
}) {
  const city = dataMunicipality(municipality)!;
  const modules = [
    "contratos",
    "obras",
    "receitas",
    ...(isExpensesMunicipality(municipality) ? ["despesas"] : []),
  ];
  return (
    <nav className={styles.navigation} aria-label={"Módulos de " + city.name}>
      <Link className={styles.link} href={"/" + municipality} prefetch={false}>
        <Button component="span" variant="subtle" color="gray">
          ← {city.name}
        </Button>
      </Link>
      {modules.map((id) => (
        <Link
          key={id}
          className={styles.link}
          href={"/" + municipality + "/" + id}
          aria-current={id === active ? "page" : undefined}
          prefetch={false}
        >
          <Button
            component="span"
            variant={id === active ? "light" : "subtle"}
            color={id === active ? "brand" : "gray"}
          >
            {id[0].toUpperCase() + id.slice(1)}
          </Button>
        </Link>
      ))}
    </nav>
  );
}
