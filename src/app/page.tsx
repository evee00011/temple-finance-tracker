'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import Papa from 'papaparse';

interface Transaction {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  type: 'contribution' | 'expense';
}

export default function Dashboard() {
  // Data State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Form Field States
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dateInput, setDateInput] = useState('');
  const [category, setCategory] = useState('Food');
  const [trxType, setTrxType] = useState<'contribution' | 'expense'>('expense');

  // Filter States
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // Status Alerts
  const [flash, setFlash] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const triggerFlash = (msg: string, type: 'success' | 'error') => {
    setFlash({ msg, type });
    setTimeout(() => setFlash(null), 4000);
  };

  async function fetchTransactions() {
    setLoading(true);
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      triggerFlash('Could not load data from database', 'error');
    } else if (data) {
      setTransactions(data as Transaction[]);
    }
    setLoading(false);
  }

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();

    const descClean = description.trim();
    const amountNum = parseFloat(amount.trim());
    const finalDate = dateInput ? dateInput : new Date().toISOString().split('T')[0];

    // Mirror validation constraints from flask controller logic
    if (!descClean || !amount || !category) {
      triggerFlash('Please fill description, amount, category', 'error');
      return;
    }

    if (isNaN(amountNum) || amountNum <= 0) {
      triggerFlash('Amount must be a positive number', 'error');
      return;
    }

    const { error } = await supabase.from('transactions').insert([
      {
        description: descClean,
        amount: amountNum,
        category,
        date: finalDate,
        type: trxType,
      },
    ]);

    if (error) {
      triggerFlash(error.message, 'error');
    } else {
      triggerFlash(`${trxType === 'contribution' ? 'Contribution' : 'Expense'} added successfully!`, 'success');
      // Reset inputs
      setDescription('');
      setAmount('');
      setDateInput('');
      fetchTransactions();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) {
      triggerFlash('Failed to delete transaction', 'error');
    } else {
      triggerFlash('Transaction deleted', 'success');
      fetchTransactions();
    }
  };

  // Compute live local runtime evaluations for active UI table views
  const filteredTransactions = transactions.filter((t) => {
    if (startDate && t.date < startDate) return false;
    if (endDate && t.date > endDate) return false;
    if (filterCategory && t.category.toLowerCase() !== filterCategory.toLowerCase()) return false;
    return true;
  });

  const currentFilteredTotal = filteredTransactions.reduce((acc, curr) => {
    return curr.type === 'contribution' ? acc + curr.amount : acc - curr.amount;
  }, 0);

  const globalTotal = transactions.reduce((acc, curr) => {
    return curr.type === 'contribution' ? acc + curr.amount : acc - curr.amount;
  }, 0);

  // Browser client side parsing generation replacing Flask streaming response logic
  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) {
      triggerFlash('No transactional lines match criteria to export', 'error');
      return;
    }
    const CSVData = filteredTransactions.map(({ date, description, type, category, amount }) => ({
      Date: date,
      Description: description,
      Type: type,
      Category: category,
      Amount: amount,
    }));

    const csv = Papa.unparse(CSVData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `temple_financial_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

  return (
    <div className="space-y-6">
      {flash && (
        <div
          className={`rounded-xl px-4 py-3 text-sm transition-all duration-200 ${
            flash.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-400/20'
              : 'bg-rose-500/10 text-rose-300 border border-rose-400/20'
          }`}
        >
          {flash.msg}
        </div>
      )}

      <div className="mb-4">
        <h1 className="text-3xl font-semibold mb-2">Temple Ledger Dashboard</h1>
        <p className="text-slate-400">Track spending, temple collections, filter data rows, and export.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Filters Panel */}
        <section className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900 p-4 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold mb-3">Filters</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end pr-5">
              <label className="text-sm">
                <span className="block mb-1 text-slate-300">Start Date</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </label>
              <label className="text-sm">
                <span className="block mb-1 text-slate-300">End Date</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </label>
              <label className="text-sm">
                <span className="block mb-1 text-slate-300">Category</span>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500"
                >
                  <option value="">All Categories</option>
                  <option value="Food">Food</option>
                  <option value="Transport">Transport</option>
                  <option value="Utilities">Utilities</option>
                  <option value="Rent">Rent</option>
                  <option value="Festival Donation">Festival Donation</option>
                  <option value="General Collection">General Collection</option>
                </select>
              </label>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-between">
            <div className="text-sm text-slate-300 flex items-center gap-2">
              <span>Filtered Net Balance:</span>
              <span className={`inline-block rounded-xl border px-3 py-1 font-semibold ${currentFilteredTotal >= 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                {currentFilteredTotal >= 0 ? `$${currentFilteredTotal.toFixed(2)}` : `-$${Math.abs(currentFilteredTotal).toFixed(2)}`}
              </span>
            </div>
            <button onClick={handleExportCSV} className="text-xs text-sky-400 hover:text-sky-300 underline font-medium">
              Export CSV (current filter)
            </button>
          </div>
        </section>

        {/* Form Entry Panel */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="text-lg font-semibold mb-3">Add Entry</h2>
          <form onSubmit={handleAddTransaction} className="space-y-3">
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
              <button type="button" onClick={() => setTrxType('expense')} className={`py-1.5 text-xs font-medium rounded-lg transition-all ${trxType === 'expense' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'text-slate-400'}`}>Expense</button>
              <button type="button" onClick={() => setTrxType('contribution')} className={`py-1.5 text-xs font-medium rounded-lg transition-all ${trxType === 'contribution' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400'}`}>Collection</button>
            </div>

            <label className="block text-sm">
              <span className="mb-1 block text-slate-300">Description / Contributor</span>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={trxType === 'contribution' ? "Enter contributor name" : "Enter expense name"}
                className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="mb-1 block text-slate-300">Amount (RM)</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="25.00"
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-300">Date</span>
                <input
                  type="date"
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none"
                />
              </label>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-300">Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none"
              >
                {trxType === 'expense' ? (
                  <>
                    <option value="Food">Food</option>
                    <option value="Transport">Transport</option>
                    <option value="Equipment">Equipment</option>
                    <option value="Utilities">Utilities</option>
                  </>
                ) : (
                  <>
                    <option value="Festival Donation">Festival Donation</option>
                    <option value="General Collection">General Collection</option>
                    <option value="Special Puja">Special Puja</option>
                  </>
                )}
              </select>
            </label>
            <button
              className={`w-full mt-2 rounded-xl px-4 py-2 border text-sm font-semibold tracking-wide transition-all ${trxType === 'contribution' ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border-sky-500/30'}`}
              type="submit"
            >
              Add {trxType === 'contribution' ? 'Collection' : 'Expense'}
            </button>
          </form>
        </section>
      </div>

      {/* Global Net Cash Balance Summary card */}
      <div className="my-4 p-4 rounded-xl border border-slate-800 bg-slate-950/40 flex items-center gap-4">
        <span className="text-sm text-slate-400">Global Book Balance:</span>
        <span className={`text-xl font-bold ${globalTotal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {globalTotal >= 0 ? `$${globalTotal.toFixed(2)}` : `-$${Math.abs(globalTotal).toFixed(2)}`}
        </span>
      </div>

      {/* Main Ledger Table View Container */}
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
                <th className="text-left px-4 py-3">Description / Name</th>
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-right px-4 py-3">Amount</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500 animate-pulse">Syncing transactions...</td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                    No records found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-300">{t.date}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${t.type === 'contribution' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                        {t.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-200">{t.description}</td>
                    <td className="px-4 py-3 text-slate-400">{t.category}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${t.type === 'contribution' ? 'text-emerald-400' : 'text-slate-200'}`}>
                      {t.type === 'contribution' ? `+$${t.amount.toFixed(2)}` : `-$${t.amount.toFixed(2)}`}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs border border-rose-500/20 px-2.5 py-1 rounded-lg transition-all"
                      >
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