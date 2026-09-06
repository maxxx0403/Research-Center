import { useState } from 'react';
import { Upload, CheckCircle2, AlertCircle, Lock } from 'lucide-react';
import { importLaboratories, importEquipment, importAllData, createAdminUser } from '@/lib/importData';

const ImportData = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [credentials, setCredentials] = useState(null);

  const handleCreateAdmin = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setCredentials(null);
    try {
      const res = await createAdminUser();
      if (res.success) {
        setCredentials(res.credentials);
        setResult(`✅ Admin account created successfully!\n\nEmail: ${res.credentials.email}\nPassword: ${res.credentials.password}\n\n⚠️  Please change the password after first login!`);
      } else {
        setError(`Failed to create admin account: ${res.error?.message}`);
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleImportLabs = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await importLaboratories();
      if (res.success) {
        setResult(`✅ Successfully imported ${res.count} laboratories`);
      } else {
        setError(`Failed to import laboratories: ${res.error?.message}`);
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleImportEquipment = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await importEquipment();
      if (res.success) {
        setResult(`✅ Successfully imported ${res.count} equipment items`);
      } else {
        setError(`Failed to import equipment: ${res.error?.message}`);
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleImportAll = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await importAllData();
      if (res.success) {
        setResult(`✅ Successfully imported:\n• ${res.laboratories} laboratories\n• ${res.equipment} equipment items`);
      } else {
        setError(`Failed to import data: ${res.error?.message}`);
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold text-foreground mb-2">Data Import</h1>
        <p className="text-muted-foreground">Import facilities and equipment data to Supabase</p>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/25 text-destructive rounded-xl p-4 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {result && (
        <div className="bg-success/10 border border-success/25 text-success rounded-xl p-4 flex items-start gap-2">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1 whitespace-pre-line">{result}</div>
        </div>
      )}

      {credentials && (
        <div className="bg-warning/10 border border-warning/25 text-warning rounded-xl p-4 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm space-y-2">
            <p className="font-semibold">Save these credentials:</p>
            <p>Email: <code className="bg-warning/20 px-2 py-1 rounded">{credentials.email}</code></p>
            <p>Password: <code className="bg-warning/20 px-2 py-1 rounded">{credentials.password}</code></p>
            <p className="text-xs opacity-80">You can now log in and change your password in Settings.</p>
          </div>
        </div>
      )}

      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-heading text-sm font-bold">Setup & Import Options</h2>
        </div>
        <div className="p-6 space-y-4">
          <button
            onClick={handleCreateAdmin}
            disabled={loading}
            className="w-full px-4 py-3 rounded-lg bg-warning text-warning-foreground font-semibold text-sm hover:bg-warning/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            <Lock className="w-4 h-4" />
            {loading ? 'Creating...' : 'Create Admin Account'}
          </button>

          <div className="border-t border-border my-4"></div>

          <button
            onClick={handleImportLabs}
            disabled={loading}
            className="w-full px-4 py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            <Upload className="w-4 h-4" />
            {loading ? 'Importing...' : 'Import Laboratories'}
          </button>

          <button
            onClick={handleImportEquipment}
            disabled={loading}
            className="w-full px-4 py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            <Upload className="w-4 h-4" />
            {loading ? 'Importing...' : 'Import Equipment'}
          </button>

          <button
            onClick={handleImportAll}
            disabled={loading}
            className="w-full px-4 py-3 rounded-lg bg-success text-success-foreground font-semibold text-sm hover:bg-success/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            <Upload className="w-4 h-4" />
            {loading ? 'Importing...' : 'Import All (Facilities & Equipment)'}
          </button>
        </div>
      </div>

      <div className="bg-muted/50 rounded-xl p-4 space-y-2">
        <p className="font-semibold text-sm text-foreground">What will be imported:</p>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li>8 Laboratories/Facilities with descriptions and requirements</li>
          <li>38 Equipment items with specifications and quantities</li>
          <li>All status and availability data</li>
        </ul>
      </div>
    </div>
  );
};

export default ImportData;
