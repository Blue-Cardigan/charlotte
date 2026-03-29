import { useEffect, useState } from "react";
import type { Brand } from "../../../shared/contracts";
import { apiFetch } from "../../lib/api";
import { AdminLayout } from "./AdminLayout";

const defaultBrandInput = {
  name: "",
  slug: "",
  color_primary: "#17152f",
  color_secondary: "#2b2a4a",
  color_accent: "#ff4f7f",
  color_background: "#fffaf7",
  persona_name: "Charlotte",
  persona_tone: "Warm, curious, and naturally conversational",
  welcome_heading: "Hey, I'm Charlotte",
  welcome_body: "I have a few short questions and I really value your honest thoughts.",
};

export function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [form, setForm] = useState(defaultBrandInput);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBrands = async () => {
    const rows = await apiFetch<Brand[]>("/api/brands", { auth: true });
    setBrands(rows);
  };

  useEffect(() => {
    void loadBrands().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Failed to load brands.");
    });
  }, []);

  const createBrand = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiFetch<Brand>("/api/brands", {
        method: "POST",
        auth: true,
        body: JSON.stringify(form),
      });
      setForm(defaultBrandInput);
      await loadBrands();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create brand.");
    } finally {
      setSaving(false);
    }
  };

  const updateBrand = async (brandId: string, field: keyof Brand, value: string) => {
    const patch: Partial<Brand> = { [field]: value };
    await apiFetch(`/api/brands/${brandId}`, {
      method: "PATCH",
      auth: true,
      body: JSON.stringify(patch),
    });
    await loadBrands();
  };

  return (
    <AdminLayout>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Create brand</h2>
        {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
        <div style={{ display: "grid", gap: 8 }}>
          {Object.entries(form).map(([key, value]) => (
            <label key={key}>
              <small className="muted">{key}</small>
              <input
                className="input"
                value={value}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    [key]: event.target.value,
                  }))
                }
              />
            </label>
          ))}
        </div>
        <button type="button" className="button-primary" onClick={() => void createBrand()} disabled={saving}>
          {saving ? "Saving..." : "Add brand"}
        </button>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Existing brands</h2>
        {brands.map((brand) => (
          <div key={brand.id} style={{ paddingBottom: 16, marginBottom: 16, borderBottom: "1px solid #e4e2ef" }}>
            <strong>{brand.name}</strong> <span className="muted">/{brand.slug}</span>
            <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
              <label>
                <small className="muted">Persona tone</small>
                <textarea
                  className="input"
                  value={brand.persona_tone}
                  onBlur={(event) => void updateBrand(brand.id, "persona_tone", event.target.value)}
                  onChange={() => undefined}
                />
              </label>
              <label>
                <small className="muted">Voice ID</small>
                <input
                  className="input"
                  defaultValue={brand.voice_id ?? ""}
                  placeholder="elevenlabs voice id"
                  onBlur={(event) => void updateBrand(brand.id, "voice_id", event.target.value)}
                />
              </label>
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}
