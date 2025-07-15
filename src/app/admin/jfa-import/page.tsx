import JfaImportForm from "@/components/JfaImportForm";

export default function JfaImportPage() {
  return (
    <main className="p-8 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">JFAメンバーインポート</h1>
      <JfaImportForm />
    </main>
  );
}
