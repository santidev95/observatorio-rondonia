import Link from "next/link";
import {
  dataMunicipality,
  type DataMunicipality,
} from "@/core/municipal-sources";
import styles from "./ModuleNavigation.module.css";
export function ModuleNavigation({
  active,
  municipality = "porto-velho",
}: {
  active: "contratos" | "obras" | "receitas";
  municipality?: DataMunicipality;
}) {
  const city = dataMunicipality(municipality)!;
  return (
    <nav className={styles.navigation} aria-label={"Módulos de " + city.name}>
      <Link href={"/" + municipality} prefetch={false}>
        ← {city.name}
      </Link>
      {["contratos", "obras", "receitas"].map((id) => (
        <Link
          key={id}
          href={"/" + municipality + "/" + id}
          aria-current={id === active ? "page" : undefined}
          prefetch={false}
        >
          {id[0].toUpperCase() + id.slice(1)}
        </Link>
      ))}
    </nav>
  );
}
