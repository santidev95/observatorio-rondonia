import Link from "next/link";
import { Button } from "@mantine/core";
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
      <Link className={styles.link} href={"/" + municipality} prefetch={false}>
        <Button component="span" variant="subtle" color="gray">
          ← {city.name}
        </Button>
      </Link>
      {["contratos", "obras", "receitas"].map((id) => (
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
