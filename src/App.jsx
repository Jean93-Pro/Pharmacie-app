import Auth from "./Auth.jsx";
import { getList, setList, subscribeList } from "./firebase.js";
import { ecouterConnexion, deconnecter } from "./firebase.js";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  LayoutGrid, Package, ShoppingCart, Users, BarChart3, AlertTriangle,
  Plus, Trash2, Pencil, X, Search, ChevronRight, Clock, TrendingUp,
  TrendingDown, CheckCircle2, XCircle, Minus, ReceiptText, PackageSearch
} from "lucide-react";

// ---------- Storage helpers (Firebase Firestore, partagé en temps réel) ----------
const SKEY = {
  meds: "medicaments",
  sales: "ventes",
  clients: "clients",
};

async function loadList(pharmacieId, key) {
  try {
    return await getList(pharmacieId, key);
  } catch (e) {
    console.error("Erreur de lecture Firebase", e);
    return [];
  }
}
async function saveList(pharmacieId, key, value) {
  try {
    await setList(pharmacieId, key, value);
  } catch (e) {
    console.error("Erreur de sauvegarde Firebase", e);
  }
}

// ---------- Utility ----------
const fmtFCFA = (n) =>
  new Intl.NumberFormat("fr-FR").format(Math.round(n || 0)) + " FCFA";

const todayISO = () => new Date().toISOString().slice(0, 10);

function daysUntil(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  d.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.round((d - now) / 86400000);
}

function expiryStatus(dateStr) {
  const days = daysUntil(dateStr);
  if (days < 0) return { label: "Expiré", tone: "danger", days };
  if (days <= 30) return { label: `${days} j restants`, tone: "danger", days };
  if (days <= 90) return { label: `${days} j restants`, tone: "warn", days };
  return { label: `${days} j restants`, tone: "ok", days };
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const CATEGORIES = [
  "Antalgique", "Antibiotique", "Antipaludique", "Antiseptique",
  "Vitamines", "Dermatologie", "Digestif", "Respiratoire", "Autre",
];

// ---------- Seed data (only used if storage is empty, first run) ----------
const seedMeds = () => ([
  {
    id: uid(), name: "Paracétamol 500mg", category: "Antalgique",
    unit: "Boîte de 20", quantity: 84, minStock: 20, price: 500,
    expiry: addDays(60), supplier: "LABOREX",
  },
  {
    id: uid(), name: "Amoxicilline 500mg", category: "Antibiotique",
    unit: "Boîte de 12", quantity: 12, minStock: 15, price: 1200,
    expiry: addDays(20), supplier: "UBIPHARM",
  },
  {
    id: uid(), name: "Coartem (ACT)", category: "Antipaludique",
    unit: "Plaquette", quantity: 30, minStock: 10, price: 2500,
    expiry: addDays(240), supplier: "PHARMIVOIRE",
  },
  {
    id: uid(), name: "Bétadine solution", category: "Antiseptique",
    unit: "Flacon 125ml", quantity: 5, minStock: 8, price: 1800,
    expiry: addDays(-5), supplier: "LABOREX",
  },
]);
function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// ---------- Small UI atoms ----------
function Badge({ tone = "ok", children }) {
  const tones = {
    ok: "badge-ok",
    warn: "badge-warn",
    danger: "badge-danger",
    neutral: "badge-neutral",
  };
  return <span className={`badge ${tones[tone]}`}>{children}</span>;
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal-panel ${wide ? "modal-wide" : ""}`}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function StatCard({ icon: Icon, label, value, sub, tone }) {
  return (
    <div className={`stat-card ${tone ? "stat-" + tone : ""}`}>
      <div className="stat-icon"><Icon size={20} /></div>
      <div className="stat-text">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

// ================= ROOT APP (gère l'authentification) =================
export default function App() {
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const unsub = ecouterConnexion((u) => {
      setUser(u);
      setCheckingAuth(false);
    });
    return () => unsub();
  }, []);

  if (checkingAuth) {
    return (
      <div className="app-shell loading-shell">
        <Style />
        <div className="loader">Chargement…</div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return <PharmacieApp pharmacieId={user.uid} pharmacieEmail={user.email} />;
}

// ================= MAIN APP =================
function PharmacieApp({ pharmacieId, pharmacieEmail }) {
  const [tab, setTab] = useState("dashboard");
  const [meds, setMeds] = useState([]);
  const [sales, setSales] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let medsReady = false, salesReady = false, clientsReady = false;
    const checkAllReady = () => {
      if (medsReady && salesReady && clientsReady) setLoading(false);
    };

    // Premier chargement : si le stock est vide (tout premier lancement
    // pour cette pharmacie), on insère quelques médicaments d'exemple.
    (async () => {
      const existing = await loadList(pharmacieId, SKEY.meds);
      if (existing.length === 0) {
        await saveList(pharmacieId, SKEY.meds, seedMeds());
      }
    })();

    // Écoute en temps réel : toute modification faite par un membre de
    // l'équipe (sur un autre appareil) met à jour l'affichage instantanément.
    const unsubMeds = subscribeList(pharmacieId, SKEY.meds, (data) => {
      setMeds(data);
      medsReady = true;
      checkAllReady();
    });
    const unsubSales = subscribeList(pharmacieId, SKEY.sales, (data) => {
      setSales(data);
      salesReady = true;
      checkAllReady();
    });
    const unsubClients = subscribeList(pharmacieId, SKEY.clients, (data) => {
      setClients(data);
      clientsReady = true;
      checkAllReady();
    });

    return () => {
      unsubMeds();
      unsubSales();
      unsubClients();
    };
  }, [pharmacieId]);

  const notify = useCallback((msg, tone = "ok") => {
    setToast({ msg, tone, id: uid() });
    setTimeout(() => setToast(null), 2600);
  }, []);

  const persistMeds = useCallback(async (next) => {
    setMeds(next);
    await saveList(pharmacieId, SKEY.meds, next);
  }, [pharmacieId]);
  const persistSales = useCallback(async (next) => {
    setSales(next);
    await saveList(pharmacieId, SKEY.sales, next);
  }, [pharmacieId]);
  const persistClients = useCallback(async (next) => {
    setClients(next);
    await saveList(pharmacieId, SKEY.clients, next);
  }, [pharmacieId]);

  const lowStock = useMemo(() => meds.filter((m) => m.quantity <= m.minStock), [meds]);
  const expiringSoon = useMemo(
    () => meds.filter((m) => daysUntil(m.expiry) <= 30).sort((a, b) => daysUntil(a.expiry) - daysUntil(b.expiry)),
    [meds]
  );

  const todaySales = useMemo(() => {
    const t = todayISO();
    return sales.filter((s) => s.date === t);
  }, [sales]);
  const todayRevenue = useMemo(() => todaySales.reduce((sum, s) => sum + s.total, 0), [todaySales]);
  const stockValue = useMemo(() => meds.reduce((sum, m) => sum + m.quantity * m.price, 0), [meds]);

  if (loading) {
    return (
      <div className="app-shell loading-shell">
        <Style />
        <div className="loader">Chargement de la pharmacie…</div>
      </div>
    );
  }

  const NAV = [
    { id: "dashboard", label: "Tableau de bord", icon: LayoutGrid },
    { id: "stock", label: "Stock", icon: Package },
    { id: "ventes", label: "Ventes", icon: ShoppingCart },
    { id: "clients", label: "Clients", icon: Users },
    { id: "rapports", label: "Rapports", icon: BarChart3 },
  ];

  return (
    <div className="app-shell">
      <Style />
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">℞</div>
          <div className="brand-text">
            <div className="brand-title">Officine</div>
            <div className="brand-sub">Gestion de pharmacie</div>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${tab === n.id ? "nav-active" : ""}`}
              onClick={() => setTab(n.id)}
            >
              <n.icon size={17} />
              <span>{n.label}</span>
              {n.id === "stock" && lowStock.length > 0 && (
                <span className="nav-pill">{lowStock.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="foot-line">{pharmacieEmail}</div>
          <div className="foot-line foot-dim">Données synchronisées</div>
          <button className="logout-btn" onClick={() => deconnecter()}>Se déconnecter</button>
        </div>
      </aside>

      <main className="main">
        {tab === "dashboard" && (
          <Dashboard
            meds={meds} sales={sales} clients={clients}
            lowStock={lowStock} expiringSoon={expiringSoon}
            todayRevenue={todayRevenue} todaySales={todaySales}
            stockValue={stockValue} setTab={setTab}
          />
        )}
        {tab === "stock" && (
          <Stock meds={meds} persistMeds={persistMeds} notify={notify} lowStock={lowStock} />
        )}
        {tab === "ventes" && (
          <Ventes
            meds={meds} persistMeds={persistMeds}
            sales={sales} persistSales={persistSales}
            clients={clients} notify={notify}
          />
        )}
        {tab === "clients" && (
          <Clients clients={clients} persistClients={persistClients} sales={sales} notify={notify} />
        )}
        {tab === "rapports" && (
          <Rapports sales={sales} meds={meds} />
        )}
      </main>

      {toast && (
        <div className={`toast toast-${toast.tone}`}>
          {toast.tone === "danger" ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ================= DASHBOARD =================
function Dashboard({ meds, lowStock, expiringSoon, todayRevenue, todaySales, stockValue, setTab }) {
  return (
    <div className="page">
      <PageHead title="Tableau de bord" sub="Vue d'ensemble de l'officine" />

      <div className="stat-grid">
        <StatCard icon={TrendingUp} label="Ventes du jour" value={fmtFCFA(todayRevenue)} sub={`${todaySales.length} transaction(s)`} tone="teal" />
        <StatCard icon={Package} label="Valeur du stock" value={fmtFCFA(stockValue)} sub={`${meds.length} références`} tone="ink" />
        <StatCard icon={AlertTriangle} label="Stock bas" value={lowStock.length} sub="références sous le seuil" tone={lowStock.length ? "amber" : "ok"} />
        <StatCard icon={Clock} label="Péremption proche" value={expiringSoon.length} sub="≤ 30 jours" tone={expiringSoon.length ? "rose" : "ok"} />
      </div>

      <div className="two-col">
        <div className="panel">
          <div className="panel-head">
            <h3><AlertTriangle size={16} /> Stock à réapprovisionner</h3>
            <button className="link-btn" onClick={() => setTab("stock")}>Voir le stock <ChevronRight size={14} /></button>
          </div>
          {lowStock.length === 0 ? (
            <EmptyRow text="Tous les stocks sont au-dessus du seuil minimum." />
          ) : (
            <ul className="mini-list">
              {lowStock.slice(0, 6).map((m) => (
                <li key={m.id}>
                  <span className="mini-name">{m.name}</span>
                  <span className="mini-meta">{m.quantity} / {m.minStock} {m.unit}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3><Clock size={16} /> Péremptions à surveiller</h3>
            <button className="link-btn" onClick={() => setTab("stock")}>Voir le stock <ChevronRight size={14} /></button>
          </div>
          {expiringSoon.length === 0 ? (
            <EmptyRow text="Aucun médicament n'expire dans les 30 prochains jours." />
          ) : (
            <ul className="mini-list">
              {expiringSoon.slice(0, 6).map((m) => {
                const st = expiryStatus(m.expiry);
                return (
                  <li key={m.id}>
                    <span className="mini-name">{m.name}</span>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyRow({ text }) {
  return <div className="empty-row"><CheckCircle2 size={16} /> {text}</div>;
}

function PageHead({ title, sub, action }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

// ================= STOCK =================
function Stock({ meds, persistMeds, notify, lowStock }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Tous");
  const [modal, setModal] = useState(null); // { mode: 'new'|'edit', data }
  const [confirmDelete, setConfirmDelete] = useState(null);

  const filtered = useMemo(() => {
    return meds
      .filter((m) => (filter === "Tous" ? true : m.category === filter))
      .filter((m) => m.name.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [meds, query, filter]);

  async function handleSave(data) {
    if (data.id) {
      await persistMeds(meds.map((m) => (m.id === data.id ? data : m)));
      notify("Médicament mis à jour.");
    } else {
      await persistMeds([...meds, { ...data, id: uid() }]);
      notify("Médicament ajouté au stock.");
    }
    setModal(null);
  }

  async function handleDelete(id) {
    await persistMeds(meds.filter((m) => m.id !== id));
    notify("Médicament supprimé.", "danger");
    setConfirmDelete(null);
  }

  return (
    <div className="page">
      <PageHead
        title="Stock"
        sub={`${meds.length} références · ${lowStock.length} sous le seuil minimum`}
        action={
          <button className="btn-primary" onClick={() => setModal({ mode: "new", data: emptyMed() })}>
            <Plus size={16} /> Ajouter un médicament
          </button>
        }
      />

      <div className="toolbar">
        <div className="search-box">
          <Search size={15} />
          <input placeholder="Rechercher un médicament…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="select" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option>Tous</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Médicament</th>
              <th>Catégorie</th>
              <th>Quantité</th>
              <th>Prix unitaire</th>
              <th>Péremption</th>
              <th>Fournisseur</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="table-empty">Aucun médicament ne correspond à la recherche.</td></tr>
            )}
            {filtered.map((m) => {
              const st = expiryStatus(m.expiry);
              const low = m.quantity <= m.minStock;
              return (
                <tr key={m.id}>
                  <td className="td-strong">{m.name}<div className="td-sub">{m.unit}</div></td>
                  <td>{m.category}</td>
                  <td>
                    <span className={low ? "qty-low" : ""}>{m.quantity}</span>
                    {low && <div className="td-sub">seuil {m.minStock}</div>}
                  </td>
                  <td>{fmtFCFA(m.price)}</td>
                  <td><Badge tone={st.tone}>{st.label}</Badge></td>
                  <td>{m.supplier || "—"}</td>
                  <td className="td-actions">
                    <button className="icon-btn" onClick={() => setModal({ mode: "edit", data: m })} aria-label="Modifier"><Pencil size={15} /></button>
                    <button className="icon-btn icon-danger" onClick={() => setConfirmDelete(m)} aria-label="Supprimer"><Trash2 size={15} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <MedModal
          mode={modal.mode}
          data={modal.data}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {confirmDelete && (
        <Modal title="Supprimer ce médicament ?" onClose={() => setConfirmDelete(null)}>
          <p className="confirm-text">
            « {confirmDelete.name} » sera retiré définitivement du stock. Cette action est irréversible.
          </p>
          <div className="modal-actions">
            <button className="btn-ghost" onClick={() => setConfirmDelete(null)}>Annuler</button>
            <button className="btn-danger" onClick={() => handleDelete(confirmDelete.id)}>Supprimer</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function emptyMed() {
  return {
    name: "", category: CATEGORIES[0], unit: "", quantity: 0,
    minStock: 5, price: 0, expiry: todayISO(), supplier: "",
  };
}

function MedModal({ mode, data, onClose, onSave }) {
  const [form, setForm] = useState(data);
  const set = (k) => (e) => {
    const v = e.target.type === "number" ? Number(e.target.value) : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
  };
  return (
    <Modal title={mode === "new" ? "Ajouter un médicament" : "Modifier le médicament"} onClose={onClose} wide>
      <div className="form-grid">
        <Field label="Nom du médicament">
          <input value={form.name} onChange={set("name")} placeholder="Ex: Paracétamol 500mg" />
        </Field>
        <Field label="Catégorie">
          <select className="select" value={form.category} onChange={set("category")}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Unité de vente">
          <input value={form.unit} onChange={set("unit")} placeholder="Ex: Boîte de 20" />
        </Field>
        <Field label="Fournisseur">
          <input value={form.supplier} onChange={set("supplier")} placeholder="Ex: LABOREX" />
        </Field>
        <Field label="Quantité en stock">
          <input type="number" min="0" value={form.quantity} onChange={set("quantity")} />
        </Field>
        <Field label="Seuil d'alerte">
          <input type="number" min="0" value={form.minStock} onChange={set("minStock")} />
        </Field>
        <Field label="Prix unitaire (FCFA)">
          <input type="number" min="0" value={form.price} onChange={set("price")} />
        </Field>
        <Field label="Date de péremption">
          <input type="date" value={form.expiry} onChange={set("expiry")} />
        </Field>
      </div>
      <div className="modal-actions">
        <button className="btn-ghost" onClick={onClose}>Annuler</button>
        <button
          className="btn-primary"
          disabled={!form.name.trim()}
          onClick={() => onSave(form)}
        >
          {mode === "new" ? "Ajouter" : "Enregistrer"}
        </button>
      </div>
    </Modal>
  );
}

// ================= VENTES (POS) =================
function Ventes({ meds, persistMeds, sales, persistSales, clients, notify }) {
  const [cart, setCart] = useState([]); // {medId, name, price, qty, maxQty}
  const [query, setQuery] = useState("");
  const [clientName, setClientName] = useState("");
  const [history, setHistory] = useState(false);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return meds
      .filter((m) => m.quantity > 0 && m.name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 6);
  }, [meds, query]);

  function addToCart(med) {
    setCart((c) => {
      const existing = c.find((i) => i.medId === med.id);
      if (existing) {
        if (existing.qty >= med.quantity) {
          notify("Quantité en stock insuffisante.", "danger");
          return c;
        }
        return c.map((i) => (i.medId === med.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...c, { medId: med.id, name: med.name, price: med.price, qty: 1, maxQty: med.quantity }];
    });
    setQuery("");
  }

  function changeQty(medId, delta) {
    setCart((c) =>
      c.map((i) => {
        if (i.medId !== medId) return i;
        const next = i.qty + delta;
        if (next < 1) return i;
        if (next > i.maxQty) { notify("Quantité en stock insuffisante.", "danger"); return i; }
        return { ...i, qty: next };
      })
    );
  }

  function removeItem(medId) {
    setCart((c) => c.filter((i) => i.medId !== medId));
  }

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

  async function finalizeSale() {
    if (cart.length === 0) return;
    const sale = {
      id: uid(),
      date: todayISO(),
      time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      client: clientName.trim() || "Client de passage",
      items: cart.map((i) => ({ medId: i.medId, name: i.name, price: i.price, qty: i.qty })),
      total,
    };
    const nextMeds = meds.map((m) => {
      const item = cart.find((i) => i.medId === m.id);
      return item ? { ...m, quantity: m.quantity - item.qty } : m;
    });
    await persistMeds(nextMeds);
    await persistSales([sale, ...sales]);
    notify(`Vente enregistrée · ${fmtFCFA(total)}`);
    setCart([]);
    setClientName("");
  }

  return (
    <div className="page">
      <PageHead
        title="Ventes"
        sub="Encaissement et historique"
        action={
          <button className="btn-ghost" onClick={() => setHistory((h) => !h)}>
            <ReceiptText size={16} /> {history ? "Retour à la caisse" : "Historique des ventes"}
          </button>
        }
      />

      {history ? (
        <SalesHistory sales={sales} />
      ) : (
        <div className="pos-grid">
          <div className="panel">
            <div className="panel-head"><h3><PackageSearch size={16} /> Ajouter un produit</h3></div>
            <div className="search-box search-box-lg">
              <Search size={15} />
              <input
                placeholder="Rechercher un médicament à vendre…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {results.length > 0 && (
              <ul className="result-list">
                {results.map((m) => (
                  <li key={m.id} onClick={() => addToCart(m)}>
                    <div>
                      <div className="mini-name">{m.name}</div>
                      <div className="td-sub">{m.quantity} en stock · {fmtFCFA(m.price)}</div>
                    </div>
                    <Plus size={16} />
                  </li>
                ))}
              </ul>
            )}
            {query.trim() && results.length === 0 && (
              <div className="empty-row">Aucun médicament disponible pour « {query} ».</div>
            )}

            <Field label="Client (optionnel)">
              <input
                list="client-suggestions"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Nom du client"
              />
              <datalist id="client-suggestions">
                {clients.map((c) => <option key={c.id} value={c.name} />)}
              </datalist>
            </Field>
          </div>

          <div className="panel cart-panel">
            <div className="panel-head"><h3><ShoppingCart size={16} /> Panier</h3></div>
            {cart.length === 0 ? (
              <EmptyRow text="Aucun article. Recherchez un médicament à gauche." />
            ) : (
              <ul className="cart-list">
                {cart.map((i) => (
                  <li key={i.medId}>
                    <div className="cart-item-name">{i.name}</div>
                    <div className="cart-item-controls">
                      <button className="icon-btn" onClick={() => changeQty(i.medId, -1)}><Minus size={14} /></button>
                      <span>{i.qty}</span>
                      <button className="icon-btn" onClick={() => changeQty(i.medId, 1)}><Plus size={14} /></button>
                    </div>
                    <div className="cart-item-price">{fmtFCFA(i.price * i.qty)}</div>
                    <button className="icon-btn icon-danger" onClick={() => removeItem(i.medId)}><Trash2 size={14} /></button>
                  </li>
                ))}
              </ul>
            )}
            <div className="cart-total-row">
              <span>Total</span>
              <span className="cart-total">{fmtFCFA(total)}</span>
            </div>
            <button className="btn-primary btn-full" disabled={cart.length === 0} onClick={finalizeSale}>
              Encaisser la vente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SalesHistory({ sales }) {
  if (sales.length === 0) return <EmptyRow text="Aucune vente enregistrée pour le moment." />;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr><th>Date</th><th>Heure</th><th>Client</th><th>Articles</th><th>Total</th></tr>
        </thead>
        <tbody>
          {sales.map((s) => (
            <tr key={s.id}>
              <td>{s.date}</td>
              <td>{s.time}</td>
              <td>{s.client}</td>
              <td className="td-sub">{s.items.map((i) => `${i.name} ×${i.qty}`).join(", ")}</td>
              <td className="td-strong">{fmtFCFA(s.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ================= CLIENTS =================
function Clients({ clients, persistClients, sales, notify }) {
  const [modal, setModal] = useState(null);
  const [query, setQuery] = useState("");

  const filtered = clients.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));

  async function handleSave(data) {
    if (data.id) {
      await persistClients(clients.map((c) => (c.id === data.id ? data : c)));
      notify("Fiche client mise à jour.");
    } else {
      await persistClients([...clients, { ...data, id: uid() }]);
      notify("Client ajouté.");
    }
    setModal(null);
  }

  async function handleDelete(id) {
    await persistClients(clients.filter((c) => c.id !== id));
    notify("Client supprimé.", "danger");
  }

  function clientSpend(name) {
    return sales.filter((s) => s.client === name).reduce((sum, s) => sum + s.total, 0);
  }

  return (
    <div className="page">
      <PageHead
        title="Clients"
        sub={`${clients.length} fiche(s) client`}
        action={
          <button className="btn-primary" onClick={() => setModal({ id: null, name: "", phone: "", notes: "" })}>
            <Plus size={16} /> Ajouter un client
          </button>
        }
      />
      <div className="toolbar">
        <div className="search-box">
          <Search size={15} />
          <input placeholder="Rechercher un client…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyRow text="Aucun client enregistré pour le moment." />
      ) : (
        <div className="client-grid">
          {filtered.map((c) => (
            <div key={c.id} className="client-card">
              <div className="client-card-head">
                <div className="client-avatar">{c.name.charAt(0).toUpperCase()}</div>
                <div>
                  <div className="mini-name">{c.name}</div>
                  <div className="td-sub">{c.phone || "Téléphone non renseigné"}</div>
                </div>
              </div>
              {c.notes && <p className="client-notes">{c.notes}</p>}
              <div className="client-card-foot">
                <span className="td-sub">Total achats : {fmtFCFA(clientSpend(c.name))}</span>
                <div className="td-actions">
                  <button className="icon-btn" onClick={() => setModal(c)}><Pencil size={14} /></button>
                  <button className="icon-btn icon-danger" onClick={() => handleDelete(c.id)}><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <ClientModal data={modal} onClose={() => setModal(null)} onSave={handleSave} />
      )}
    </div>
  );
}

function ClientModal({ data, onClose, onSave }) {
  const [form, setForm] = useState(data);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Modal title={data.id ? "Modifier le client" : "Ajouter un client"} onClose={onClose}>
      <div className="form-grid form-grid-1">
        <Field label="Nom complet">
          <input value={form.name} onChange={set("name")} placeholder="Ex: Awa Koné" />
        </Field>
        <Field label="Téléphone">
          <input value={form.phone} onChange={set("phone")} placeholder="Ex: 07 00 00 00 00" />
        </Field>
        <Field label="Notes (allergies, traitement en cours…)">
          <textarea value={form.notes} onChange={set("notes")} rows={3} />
        </Field>
      </div>
      <div className="modal-actions">
        <button className="btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn-primary" disabled={!form.name.trim()} onClick={() => onSave(form)}>
          {data.id ? "Enregistrer" : "Ajouter"}
        </button>
      </div>
    </Modal>
  );
}

// ================= RAPPORTS =================
function Rapports({ sales, meds }) {
  const last7 = useMemo(() => {
    const days = [...Array(7)].map((_, idx) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - idx));
      return d.toISOString().slice(0, 10);
    });
    return days.map((day) => ({
      day,
      label: new Date(day).toLocaleDateString("fr-FR", { weekday: "short" }),
      total: sales.filter((s) => s.date === day).reduce((sum, s) => sum + s.total, 0),
    }));
  }, [sales]);

  const maxVal = Math.max(1, ...last7.map((d) => d.total));

  const topProducts = useMemo(() => {
    const counts = {};
    sales.forEach((s) => s.items.forEach((i) => {
      counts[i.name] = (counts[i.name] || 0) + i.qty;
    }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [sales]);

  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
  const totalSalesCount = sales.length;
  const avgTicket = totalSalesCount ? totalRevenue / totalSalesCount : 0;

  return (
    <div className="page">
      <PageHead title="Rapports" sub="Performance de l'officine" />

      <div className="stat-grid">
        <StatCard icon={TrendingUp} label="Chiffre d'affaires total" value={fmtFCFA(totalRevenue)} tone="teal" />
        <StatCard icon={ShoppingCart} label="Ventes enregistrées" value={totalSalesCount} tone="ink" />
        <StatCard icon={BarChart3} label="Panier moyen" value={fmtFCFA(avgTicket)} tone="amber" />
      </div>

      <div className="panel">
        <div className="panel-head"><h3><BarChart3 size={16} /> Ventes des 7 derniers jours</h3></div>
        <div className="bar-chart">
          {last7.map((d) => (
            <div key={d.day} className="bar-col">
              <div className="bar-track">
                <div className="bar-fill" style={{ height: `${(d.total / maxVal) * 100}%` }} title={fmtFCFA(d.total)} />
              </div>
              <div className="bar-label">{d.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h3><TrendingDown size={16} /> Produits les plus vendus</h3></div>
        {topProducts.length === 0 ? (
          <EmptyRow text="Pas encore de ventes enregistrées." />
        ) : (
          <ul className="mini-list">
            {topProducts.map(([name, qty]) => (
              <li key={name}>
                <span className="mini-name">{name}</span>
                <span className="mini-meta">{qty} unité(s) vendue(s)</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ================= STYLE =================
function Style() {
  return (
    <style>{`
      .app-shell {
        --ink: #1c2b24;
        --ink-soft: #4b5c53;
        --paper: #f6f4ee;
        --panel: #ffffff;
        --line: #e2e2d8;
        --teal: #1f5148;
        --teal-deep: #123a33;
        --sage: #e4ece4;
        --amber: #b8722a;
        --amber-soft: #f4e3cd;
        --rose: #a5433a;
        --rose-soft: #f3ddd8;
        --ok-soft: #e1ede2;
        --ok: #2f6b3f;
        font-family: 'IBM Plex Sans', 'Segoe UI', Arial, sans-serif;
        display: flex;
        min-height: 640px;
        background: var(--paper);
        color: var(--ink);
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid var(--line);
      }
      .app-shell * { box-sizing: border-box; }
      .loading-shell { align-items: center; justify-content: center; }
      .loader { font-size: 14px; color: var(--ink-soft); }

      .sidebar {
        width: 220px;
        flex-shrink: 0;
        background: var(--teal-deep);
        color: #f3f1e9;
        display: flex;
        flex-direction: column;
        padding: 20px 14px;
      }
      .brand { display: flex; align-items: center; gap: 10px; padding: 4px 6px 22px; }
      .brand-mark {
        width: 34px; height: 34px; border-radius: 8px;
        background: #f3f1e9; color: var(--teal-deep);
        display: flex; align-items: center; justify-content: center;
        font-size: 18px; font-weight: 700; font-family: Georgia, serif;
      }
      .brand-title { font-family: Georgia, 'Times New Roman', serif; font-size: 16.5px; font-weight: 700; letter-spacing: 0.2px; }
      .brand-sub { font-size: 11px; opacity: 0.65; margin-top: 1px; }

      .nav { display: flex; flex-direction: column; gap: 2px; flex: 1; }
      .nav-item {
        display: flex; align-items: center; gap: 10px;
        padding: 9px 10px; border-radius: 7px; border: none;
        background: transparent; color: #d9e3dc; font-size: 13.5px;
        cursor: pointer; text-align: left; position: relative;
        transition: background 0.15s ease;
      }
      .nav-item:hover { background: rgba(255,255,255,0.06); }
      .nav-active { background: rgba(255,255,255,0.13); color: #ffffff; font-weight: 600; }
      .nav-pill {
        margin-left: auto; background: var(--rose); color: white;
        font-size: 10.5px; font-weight: 700; border-radius: 10px;
        padding: 1px 6px;
      }
      .sidebar-foot { border-top: 1px solid rgba(255,255,255,0.12); padding-top: 12px; margin-top: 8px; }
      .foot-line { font-size: 11px; color: #cfd9d1; word-break: break-all; }
      .foot-dim { opacity: 0.6; margin-top: 2px; }
      .logout-btn {
        margin-top: 10px; width: 100%; background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.15); color: #f3f1e9;
        padding: 7px; border-radius: 7px; font-size: 12px; cursor: pointer;
      }
      .logout-btn:hover { background: rgba(255,255,255,0.16); }

      .main { flex: 1; padding: 26px 30px; overflow-y: auto; max-height: 900px; }
      .page { display: flex; flex-direction: column; gap: 20px; }
      .page-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; }
      .page-head h1 { font-family: Georgia, 'Times New Roman', serif; font-size: 24px; margin: 0; color: var(--teal-deep); }
      .page-head p { margin: 4px 0 0; font-size: 13px; color: var(--ink-soft); }

      .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
      .stat-card {
        background: var(--panel); border: 1px solid var(--line); border-radius: 10px;
        padding: 14px 16px; display: flex; gap: 12px; align-items: flex-start;
      }
      .stat-icon {
        width: 34px; height: 34px; border-radius: 8px; background: var(--sage);
        color: var(--teal); display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      }
      .stat-teal .stat-icon { background: var(--sage); color: var(--teal); }
      .stat-amber .stat-icon { background: var(--amber-soft); color: var(--amber); }
      .stat-rose .stat-icon { background: var(--rose-soft); color: var(--rose); }
      .stat-ink .stat-icon { background: #ece9de; color: var(--ink); }
      .stat-ok .stat-icon { background: var(--ok-soft); color: var(--ok); }
      .stat-value { font-size: 19px; font-weight: 700; font-family: Georgia, serif; }
      .stat-label { font-size: 12px; color: var(--ink-soft); margin-top: 1px; }
      .stat-sub { font-size: 11px; color: #8b988f; margin-top: 3px; }

      .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 16px 18px; }
      .panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
      .panel-head h3 { display: flex; align-items: center; gap: 7px; font-size: 13.5px; margin: 0; color: var(--teal-deep); }
      .link-btn { display: flex; align-items: center; gap: 2px; border: none; background: none; color: var(--teal); font-size: 12px; cursor: pointer; font-weight: 600; }

      .mini-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
      .mini-list li { display: flex; align-items: center; justify-content: space-between; padding: 7px 0; border-bottom: 1px dashed var(--line); font-size: 13px; }
      .mini-list li:last-child { border-bottom: none; }
      .mini-name { font-weight: 600; }
      .mini-meta { font-size: 12px; color: var(--ink-soft); }
      .empty-row { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--ink-soft); padding: 10px 0; }

      .toolbar { display: flex; gap: 10px; }
      .search-box { display: flex; align-items: center; gap: 8px; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 8px 12px; flex: 1; max-width: 340px; color: var(--ink-soft); }
      .search-box input { border: none; outline: none; background: none; font-size: 13px; width: 100%; color: var(--ink); }
      .search-box-lg { max-width: none; margin-bottom: 10px; }
      .select { border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; font-size: 13px; background: var(--panel); color: var(--ink); }

      .table-wrap { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
      .table { width: 100%; border-collapse: collapse; font-size: 13px; }
      .table th { text-align: left; padding: 11px 14px; background: var(--sage); color: var(--teal-deep); font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.4px; font-weight: 700; }
      .table td { padding: 11px 14px; border-top: 1px solid var(--line); vertical-align: top; }
      .td-strong { font-weight: 600; }
      .td-sub { font-size: 11.5px; color: #8b988f; margin-top: 2px; }
      .td-actions { display: flex; gap: 6px; justify-content: flex-end; }
      .table-empty { text-align: center; color: var(--ink-soft); padding: 24px !important; }
      .qty-low { color: var(--rose); font-weight: 700; }

      .badge { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 20px; font-size: 11px; font-weight: 700; }
      .badge-ok { background: var(--ok-soft); color: var(--ok); }
      .badge-warn { background: var(--amber-soft); color: var(--amber); }
      .badge-danger { background: var(--rose-soft); color: var(--rose); }
      .badge-neutral { background: #ece9de; color: var(--ink-soft); }

      .icon-btn { width: 28px; height: 28px; border-radius: 6px; border: 1px solid var(--line); background: var(--panel); color: var(--ink-soft); display: flex; align-items: center; justify-content: center; cursor: pointer; }
      .icon-btn:hover { background: var(--sage); color: var(--teal-deep); }
      .icon-danger:hover { background: var(--rose-soft); color: var(--rose); border-color: var(--rose-soft); }

      .btn-primary { display: flex; align-items: center; gap: 6px; background: var(--teal); color: white; border: none; padding: 9px 15px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
      .btn-primary:hover { background: var(--teal-deep); }
      .btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
      .btn-ghost { display: flex; align-items: center; gap: 6px; background: none; border: 1px solid var(--line); color: var(--ink); padding: 9px 15px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
      .btn-ghost:hover { background: var(--sage); }
      .btn-danger { background: var(--rose); color: white; border: none; padding: 9px 15px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
      .btn-full { width: 100%; justify-content: center; margin-top: 10px; }

      .modal-backdrop { position: fixed; inset: 0; background: rgba(18,25,21,0.45); display: flex; align-items: center; justify-content: center; z-index: 50; }
      .modal-panel { background: var(--panel); border-radius: 12px; width: 420px; max-width: 92vw; max-height: 86vh; overflow-y: auto; box-shadow: 0 20px 50px rgba(0,0,0,0.25); }
      .modal-wide { width: 560px; }
      .modal-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid var(--line); }
      .modal-head h3 { margin: 0; font-size: 15px; font-family: Georgia, serif; color: var(--teal-deep); }
      .modal-body { padding: 18px; }
      .modal-actions { display: flex; justify-content: flex-end; gap: 8px; padding: 4px 18px 18px; }
      .confirm-text { padding: 0 18px; font-size: 13.5px; color: var(--ink-soft); }

      .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .form-grid-1 { grid-template-columns: 1fr; }
      .field { display: flex; flex-direction: column; gap: 5px; font-size: 12.5px; }
      .field-label { color: var(--ink-soft); font-weight: 600; }
      .field input, .field select, .field textarea {
        border: 1px solid var(--line); border-radius: 7px; padding: 8px 10px; font-size: 13px; color: var(--ink); font-family: inherit; background: var(--panel);
      }
      .field input:focus, .field select:focus, .field textarea:focus { outline: 2px solid var(--teal); outline-offset: 1px; }

      .pos-grid { display: grid; grid-template-columns: 1.3fr 1fr; gap: 16px; align-items: start; }
      .cart-panel { position: sticky; top: 0; }
      .result-list { list-style: none; margin: 8px 0 14px; padding: 0; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
      .result-list li { display: flex; align-items: center; justify-content: space-between; padding: 9px 12px; cursor: pointer; border-bottom: 1px solid var(--line); }
      .result-list li:last-child { border-bottom: none; }
      .result-list li:hover { background: var(--sage); }

      .cart-list { list-style: none; margin: 0 0 12px; padding: 0; display: flex; flex-direction: column; gap: 8px; }
      .cart-list li { display: grid; grid-template-columns: 1fr auto auto auto; align-items: center; gap: 10px; font-size: 13px; padding-bottom: 8px; border-bottom: 1px dashed var(--line); }
      .cart-item-name { font-weight: 600; }
      .cart-item-controls { display: flex; align-items: center; gap: 6px; font-weight: 600; }
      .cart-item-price { color: var(--ink-soft); font-size: 12.5px; }
      .cart-total-row { display: flex; justify-content: space-between; align-items: center; font-size: 14px; padding-top: 8px; border-top: 1px solid var(--line); font-weight: 700; }
      .cart-total { font-family: Georgia, serif; color: var(--teal-deep); font-size: 18px; }

      .client-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 14px; }
      .client-card { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 14px; }
      .client-card-head { display: flex; gap: 10px; align-items: center; }
      .client-avatar { width: 36px; height: 36px; border-radius: 50%; background: var(--sage); color: var(--teal-deep); display: flex; align-items: center; justify-content: center; font-weight: 700; font-family: Georgia, serif; }
      .client-notes { font-size: 12px; color: var(--ink-soft); margin: 10px 0 0; }
      .client-card-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--line); }

      .bar-chart { display: flex; align-items: flex-end; gap: 10px; height: 140px; padding-top: 10px; }
      .bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; height: 100%; justify-content: flex-end; }
      .bar-track { width: 100%; height: 110px; background: var(--sage); border-radius: 5px; display: flex; align-items: flex-end; overflow: hidden; }
      .bar-fill { width: 100%; background: var(--teal); border-radius: 5px 5px 0 0; min-height: 3px; transition: height 0.3s ease; }
      .bar-label { font-size: 11px; color: var(--ink-soft); text-transform: capitalize; }

      .toast {
        position: fixed; bottom: 18px; left: 50%; transform: translateX(-50%);
        background: var(--teal-deep); color: white; padding: 10px 16px; border-radius: 8px;
        font-size: 13px; display: flex; align-items: center; gap: 8px; z-index: 60;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      }
      .toast-danger { background: var(--rose); }

      @media (max-width: 760px) {
        .app-shell { flex-direction: column; }
        .sidebar { width: 100%; flex-direction: row; align-items: center; padding: 12px; }
        .nav { flex-direction: row; overflow-x: auto; }
        .nav-item span { display: none; }
        .sidebar-foot { display: none; }
        .brand-sub { display: none; }
        .stat-grid, .two-col, .pos-grid, .form-grid { grid-template-columns: 1fr; }
      }
    `}</style>
  );
}
