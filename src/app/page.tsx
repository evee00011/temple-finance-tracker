'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import Papa from 'papaparse';

// Unified interface for UI rendering
interface UnifiedRecord {
  id: string | number;
  date: string;
  description: string; // collection_donor_name OR expense_item
  category: string;    // collection_category OR 'Expense'
  amount: number;
  type: 'collection' | 'expense';
  paymentMode: string;
  statusOrApprovedBy: string; // collection_status OR expense_approved_by
  remarks?: string;
}

export default function Dashboard() {
  // Hydration Mount Guard
  const [mounted, setMounted] = useState(false);

  // Auth Session States
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(true);

  // Core Data States
  const [records, setRecords] = useState<UnifiedRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Core Form Input States
  const [trxType, setTrxType] = useState<'collection' | 'expense'>('expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dateInput, setDateInput] = useState('');
  const [category, setCategory] = useState('General Collection');
  const [paymentMode, setPaymentMode] = useState('Cash');
  
  // Custom context fields from your new tables
  const [collectionStatus, setCollectionStatus] = useState('Completed');
  const [expenseApprovedBy, setExpenseApprovedBy] = useState('');
  const [collectionRemarks, setCollectionRemarks] = useState('');

  // Filter States
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'collection' | 'expense'>('all');

  const [flash, setFlash] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // 1. Structural Hydration Fix + Auth Monitor
  useEffect(() => {
    setMounted(true);
    let isMounted = true;

    async function checkInitialSession() {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (isMounted) {
          setSession(initialSession);
          if (initialSession) {
            await fetchData();
          }
        }
      } catch (err: any) {
        console.error("Auth initialization failed:", err);
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    }

    checkInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      if (isMounted) {
        setSession(currentSession);
        if (currentSession) {
          await fetchData();
          setAuthLoading(false);
        } else {
          setRecords([]);
          setAuthLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const triggerFlash = (msg: string, type: 'success' | 'error') => {
    setFlash({ msg, type });
    setTimeout(() => setFlash(null), 4000);
  };

  // 2. Handle Authentication Actions
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      triggerFlash(error.message, 'error');
      setAuthLoading(false);
    } else {
      setSession(data.session);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  async function fetchData() {
    setLoading(true);
    
    const [collectionsRes, expensesRes] = await Promise.all([
      supabase.from('collection').select('*'),
      supabase.from('expense').select('*')
    ]);

    if (collectionsRes.error || expensesRes.error) {
      triggerFlash('Access Denied: Unregistered email or unauthorized token permissions.', 'error');
      setLoading(false);
      return;
    }

    const mappedCollections: UnifiedRecord[] = (collectionsRes.data || []).map((c) => ({
      id: c.id,
      date: c.collection_date,
      description: c.collection_donor_name,
      category: c.collection_category,
      amount: parseFloat(c.collection_amount),
      type: 'collection',
      paymentMode: c.collection_payment_mode,
      statusOrApprovedBy: c.collection_status,
      remarks: c.collection_remarks
    }));

    const mappedExpenses: UnifiedRecord[] = (expensesRes.data || []).map((e) => ({
      id: e.expense_voucher_no,
      date: e.expense_date,
      description: e.expense_item,
      category: 'Expense',
      amount: parseFloat(e.expense_amount),
      type: 'expense',
      paymentMode: e.expense_payment_mode,
      statusOrApprovedBy: e.expense_approved_by
    }));

    const combined = [...mappedCollections, ...mappedExpenses].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    setRecords(combined);
    setLoading(false);
  }

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanDesc = description.trim();
    const cleanAmount = parseFloat(amount.trim());
    const finalDate = dateInput ? dateInput : new Date().toISOString().split('T')[0];

    if (!cleanDesc || !amount) {
      triggerFlash('Please fill out the description and amount inputs.', 'error');
      return;
    }

    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      triggerFlash('Amount must be a positive number', 'error');
      return;
    }

    if (trxType === 'collection') {
      const { error } = await supabase.from('collection').insert([
        {
          collection_date: finalDate,
          collection_donor_name: cleanDesc,
          collection_category: category,
          collection_amount: cleanAmount,
          collection_status: collectionStatus,
          collection_payment_mode: paymentMode,
          collection_remarks: collectionRemarks
        }
      ]);
      if (error) return triggerFlash(error.message, 'error');
    } else {
      const { error } = await supabase.from('expense').insert([
        {
          expense_date: finalDate,
          expense_item: cleanDesc,
          expense_amount: cleanAmount,
          expense_payment_mode: paymentMode,
          expense_approved_by: expenseApprovedBy || 'Pending Admin'
        }
      ]);
      if (error) return triggerFlash(error.message, 'error');
    }

    triggerFlash(`${trxType === 'collection' ? 'Collection line' : 'Expense line'} added successfully!`, 'success');
    
    setDescription('');
    setAmount('');
    setCollectionRemarks('');
    setExpenseApprovedBy('');
    fetchData();
  };

  const handleDelete = async (target: UnifiedRecord) => {
    const table = target.type === 'collection' ? 'collection' : 'expense';
    const matchColumn = target.type === 'collection' ? 'id' : 'expense_voucher_no';

    const { error } = await supabase.from(table).delete().eq(matchColumn, target.id);

    if (error) {
      triggerFlash(`Deletion failed: ${error.message}`, 'error');
    } else {
      triggerFlash('Entry successfully purged', 'success');
      fetchData();
    }
  };

  const filteredRecords = records.filter((r) => {
    if (startDate && r.date < startDate) return false;
    if (endDate && r.date > endDate) return false;
    if (filterType !== 'all' && r.type !== filterType) return false;
    return true;
  });

  const currentFilteredTotal = filteredRecords.reduce((acc, curr) => {
    return curr.type === 'collection' ? acc + curr.amount : acc - curr.amount;
  }, 0);

  const globalTotal = records.reduce((acc, curr) => {
    return curr.type === 'collection' ? acc + curr.amount : acc - curr.amount;
  }, 0);

  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      triggerFlash('No transactional lines match filter criteria to export', 'error');
      return;
    }
    const CSVData = filteredRecords.map((r) => ({
      Date: r.date,
      Type: r.type.toUpperCase(),
      'Description / Name': r.description,
      Category: r.category,
      Amount: r.amount,
      'Payment Mode': r.paymentMode,
      'Status / Approved By': r.statusOrApprovedBy,
      Remarks: r.remarks || ''
    }));

    const csv = Papa.unparse(CSVData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `temple_dual_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

  // 3. Render State Guards (Bypasses Hydration Loop)
  if (!mounted || authLoading) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
        <div className="w-6 h-6 border-2 border-t-transparent border-amber-500 rounded-full animate-spin"></div>
        <p className="text-sm font-medium animate-pulse">Checking credentials...</p>
      </div>
    );
  }

  // Gatekeeper Login Screen
  if (!session) {
    return (
      <div className="max-w-md mx-auto mt-12 p-6 rounded-2xl border border-slate-800 bg-slate-900 shadow-xl">
        <h2 className="text-2xl font-bold mb-1 tracking-tight text-center">Treasurer Login</h2>
        <p className="text-xs text-slate-400 text-center mb-6"></p>
        
        {flash && (
          <div className="mb-4 rounded-xl px-4 py-2.5 text-xs bg-rose-500/10 text-rose-300 border border-rose-400/20">
            {flash.msg}
          </div>
        )}
        
        <form onSubmit={handleLogin} className="space-y-4">
          <label className="block text-sm">
            <span className="block mb-1 text-slate-300 font-medium">Email Address</span>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500" 
              required 
            />
          </label>
          <label className="block text-sm">
            <span className="block mb-1 text-slate-300 font-medium">Password</span>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500" 
              required 
            />
          </label>
          <button 
            type="submit" 
            className="w-full rounded-xl bg-amber-500 hover:bg-amber-600 py-2.5 text-sm font-semibold tracking-wide shadow-md transition-colors text-slate-950"
          >
            Login
          </button>
        </form>
      </div>
    );
  }

  // Live Core Dashboard
  return (
    <div className="space-y-6">
      {flash && (
        <div className={`rounded-xl px-4 py-3 text-sm transition-all duration-200 border ${flash.type === 'success' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-400/20' : 'bg-rose-500/10 text-rose-300 border-rose-400/20'}`}>
          {flash.msg}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-3xl font-semibold">Temple Dual-Ledger</h1>
          <p className="text-xs text-slate-400">
            Secure session active for: <span className="text-amber-500 font-medium">{session.user.email}</span>
          </p>
        </div>
        <button 
          onClick={handleLogout} 
          className="self-start text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-1.5 rounded-lg transition-all font-medium"
        >
          Secure Sign Out
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Filters Panel */}
        <section className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900 p-4 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold mb-3">Ledger Filters</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end pr-5">
              <label className="text-sm">
                <span className="block mb-1 text-slate-300">Start Date</span>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none" />
              </label>
              <label className="text-sm">
                <span className="block mb-1 text-slate-300">End Date</span>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none" />
              </label>
              <label className="text-sm">
                <span className="block mb-1 text-slate-300">Ledger Type</span>
                <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)} className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none">
                  <option value="all">All Types</option>
                  <option value="collection">Collections Only</option>
                  <option value="expense">Expenses Only</option>
                </select>
              </label>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-between">
            <div className="text-sm text-slate-300 flex items-center gap-2">
              <span>Filtered Net Flow:</span>
              <span className={`inline-block rounded-xl border px-3 py-1 font-semibold ${currentFilteredTotal >= 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                {currentFilteredTotal >= 0 ? `RM ${currentFilteredTotal.toFixed(2)}` : `-RM ${Math.abs(currentFilteredTotal).toFixed(2)}`}
              </span>
            </div>
            <button onClick={handleExportCSV} className="text-xs text-sky-400 hover:text-sky-300 underline font-medium">
              Export Integrated CSV
            </button>
          </div>
        </section>

        {/* Dynamic Schema Form Panel */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="text-lg font-semibold mb-3">Add Entry</h2>
          <form onSubmit={handleAddTransaction} className="space-y-3">
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
              <button type="button" onClick={() => setTrxType('expense')} className={`py-1.5 text-xs font-medium rounded-lg transition-all ${trxType === 'expense' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'text-slate-400'}`}>Expense</button>
              <button type="button" onClick={() => setTrxType('collection')} className={`py-1.5 text-xs font-medium rounded-lg transition-all ${trxType === 'collection' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400'}`}>Collection</button>
            </div>

            <label className="block text-sm">
              <span className="mb-1 block text-slate-300">{trxType === 'collection' ? 'Donor / Contributor Name' : 'Expense Item / Item Description'}</span>
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={trxType === 'collection' ? "Enter name" : "Enter expense"} className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none" />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="mb-1 block text-slate-300">Amount (RM)</span>
                <input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50.00" className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none" />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-300">Date</span>
                <input type="date" value={dateInput} onChange={(e) => setDateInput(e.target.value)} className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none" />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="mb-1 block text-slate-300">Payment Mode</span>
                <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none">
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </label>
              
              {trxType === 'collection' ? (
                <label className="block text-sm">
                  <span className="mb-1 block text-slate-300">Category</span>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none">
                    <option value="General Collection">General Collection</option>
                    <option value="Festival Donation">Festival Donation</option>
                    <option value="Special Puja">Special Puja</option>
                  </select>
                </label>
              ) : (
                <label className="block text-sm">
                  <span className="mb-1 block text-slate-300">Approved By</span>
                  <input value={expenseApprovedBy} onChange={(e) => setExpenseApprovedBy(e.target.value)} placeholder="Enter approver" className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none" />
                </label>
              )}
            </div>

            {trxType === 'collection' && (
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="mb-1 block text-slate-300">Status</span>
                  <select value={collectionStatus} onChange={(e) => setCollectionStatus(e.target.value)} className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none">
                    <option value="Completed">Completed</option>
                    <option value="Pending">Pending</option>
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-slate-300">Remarks</span>
                  <input value={collectionRemarks} onChange={(e) => setCollectionRemarks(e.target.value)} placeholder="e.g., Diwali special" className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none" />
                </label>
              </div>
            )}

            <button className={`w-full mt-2 rounded-xl px-4 py-2 border text-sm font-semibold tracking-wide transition-all ${trxType === 'collection' ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'}`} type="submit">
              Save {trxType === 'collection' ? 'Collection' : 'Expense'}
            </button>
          </form>
        </section>
      </div>

      {/* Global Net Balance Card */}
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 flex items-center gap-4">
        <span className="text-sm text-slate-400">Total Book Value Balance:</span>
        <span className={`text-xl font-bold ${globalTotal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {globalTotal >= 0 ? `RM ${globalTotal.toFixed(2)}` : `-RM ${Math.abs(globalTotal).toFixed(2)}`}
        </span>
      </div>

      {/* Dynamic Main Consolidated Ledger Table */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/50">
          <h2 className="text-lg font-semibold">Ledger Entries</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-slate-300 bg-slate-800/50">
              <tr>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Item / Name</th>
                <th className="text-left px-4 py-3">Mode</th>
                <th className="text-left px-4 py-3">Category / Auth</th>
                <th className="text-right px-4 py-3">Amount</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500 animate-pulse">Syncing transactions...</td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-400">No matching database lines found.</td>
                </tr>
              ) : (
                filteredRecords.map((r, index) => (
                  <tr key={`${r.type}-${r.id}-${index}`} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 text-slate-300">{r.date}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase font-bold ${r.type === 'collection' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                        {r.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-200">
                      {r.description}
                      {r.remarks && <span className="block text-xs text-slate-500 italic">{r.remarks}</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{r.paymentMode}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {r.type === 'collection' ? r.category : `Auth: ${r.statusOrApprovedBy}`}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${r.type === 'collection' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {r.type === 'collection' ? `+RM ${r.amount.toFixed(2)}` : `-RM ${r.amount.toFixed(2)}`}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleDelete(r)} className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs border border-rose-500/20 px-2.5 py-1 rounded-lg transition-all">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}