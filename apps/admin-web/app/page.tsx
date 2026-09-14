import styles from "./page.module.css";

const modules = [
  { name: "Μενού & συνταγές", milestone: "M5", status: "Επόμενο" },
  { name: "Παραγγελίες", milestone: "M5", status: "Επόμενο" },
  { name: "Πελάτες & εταιρικοί", milestone: "M6", status: "Προγραμματισμένο" },
  { name: "Inventory & waste", milestone: "M7", status: "Προγραμματισμένο" },
  { name: "Loyalty & subscriptions", milestone: "M8", status: "Προγραμματισμένο" },
];

export default function AdminHomePage() {
  return (
    <main className={styles.shell}>
      <p className={styles.eyebrow}>Food App · Admin</p>
      <h1 className={styles.title}>Καλωσήρθες</h1>
      <p className={styles.lead}>
        Αυτό είναι το σκελετό dashboard (M0). Το auth και τα βασικά components του design
        system είναι έτοιμα· τα λειτουργικά modules προστίθενται ένα-ένα στα επόμενα
        milestones.
      </p>

      <div className={styles.moduleList}>
        {modules.map((m) => (
          <div key={m.name} className={styles.moduleRow}>
            <span>{m.name}</span>
            <span className={styles.status}>
              {m.milestone} · {m.status}
            </span>
          </div>
        ))}
      </div>
    </main>
  );
}
