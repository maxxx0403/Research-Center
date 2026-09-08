import { useState, useRef, useEffect } from 'react';
import { Download, Upload, FileText, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { validateUploadFile, sanitizeText } from '@/lib/validation';

const UserForms = () => {
  const { user } = useAuth();
  const fileRef = useRef(null);
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch user submissions
  const fetchSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from('paper_submissions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setSubmissions(data || []);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) {
      fetchSubmissions();
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      alert('Please select a file');
      return;
    }

    const fileErr = validateUploadFile(file);
    if (fileErr) {
      alert(fileErr);
      return;
    }

    setUploading(true);
    setSuccessMsg('');

    try {
      const ext = file.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${ext}`;

      // Upload file to storage
      const { error: uploadErr } = await supabase.storage
        .from('submissions')
        .upload(filePath, file);
      
      if (uploadErr) throw uploadErr;

      // Insert record into database
      const { error: dbErr } = await supabase
        .from('paper_submissions')
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_path: filePath,
          file_type: ext || '',
          description: sanitizeText(description, { maxLength: 1000 }),
          status: 'submitted'
        });

      if (dbErr) throw dbErr;

      setSuccessMsg('✓ File submitted successfully!');
      setDescription('');
      if (fileRef.current) fileRef.current.value = '';
      await fetchSubmissions();
    } catch (error) {
      alert('Error uploading file: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (sub) => {
    if (!confirm('Delete this submission?')) return;
    
    try {
      await supabase.storage.from('submissions').remove([sub.file_path]);
      await supabase.from('paper_submissions').delete().eq('id', sub.id);
      await fetchSubmissions();
    } catch (error) {
      alert('Error deleting: ' + error.message);
    }
  };

  const downloadForms = [
    { 
      label: 'Facility/Equipment Use Clearance', 
      file: '/forms/UREC-QF-33_Facility_Equipment_Use_Clearance.pdf', 
      code: 'UREC-QF-33',
      description: 'Required for facility and equipment usage'
    },
    { 
      label: 'Hazardous Waste Material Disposal Form', 
      file: '/forms/UREC-QF-35_Hazardous_Waste_Material_Disposal_Form.docx', 
      code: 'UREC-QF-35',
      description: 'Required for proper waste disposal'
    }
  ];

  const inputClass = "w-full px-4 py-3 border-2 border-border rounded-xl text-base bg-card text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";

  return (
    <div className="space-y-8">
      {/* Submit Papers + Downloadable Forms, side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div>
          <h2 className="font-heading text-lg font-bold text-foreground mb-4">Submit Papers</h2>
          <div className="bg-card rounded-xl border-2 border-border p-6">
            {successMsg && (
              <div className="bg-success/10 border border-success/25 text-success rounded-xl p-3 mb-4 text-sm font-medium flex items-center gap-2 animate-pulse">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> {successMsg}
              </div>
            )}

            <div className="space-y-4 mb-4">
              <div>
                <label className="block mb-1.5 font-semibold text-sm text-foreground">
                  File (PDF or DOCX) <span className="text-destructive">*</span>
                </label>
                <input 
                  ref={fileRef} 
                  type="file" 
                  accept=".pdf,.docx" 
                  className={inputClass}
                  disabled={uploading}
                />
                <p className="text-xs text-muted-foreground mt-1">Supported: PDF, DOCX | Max: 50MB</p>
              </div>

              <div>
                <label className="block mb-1.5 font-semibold text-sm text-foreground">
                  Description
                </label>
                <textarea 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)} 
                  placeholder="e.g., Clearance form for Lab 301, Equipment use documentation" 
                  className={`${inputClass} resize-none`}
                  rows="3"
                  disabled={uploading}
                />
              </div>
            </div>

            <button 
              onClick={handleUpload} 
              disabled={uploading}
              className="gradient-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold text-sm border-none cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 w-full justify-center"
            >
              <Upload className="w-4 h-4" /> 
              {uploading ? 'Uploading…' : 'Submit Paper'}
            </button>
          </div>
        </div>

        <div>
          <h2 className="font-heading text-lg font-bold text-foreground mb-4">Downloadable Forms</h2>
          <div className="grid grid-cols-1 gap-4">
            {downloadForms.map((form) => (
              <a 
                key={form.code} 
                href={form.file} 
                download
                className="bg-card rounded-xl border-2 border-border p-5 flex items-start gap-4 no-underline hover:border-primary hover:shadow-md transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Download className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground font-semibold tracking-wider uppercase mb-1">{form.code}</p>
                  <p className="font-semibold text-sm text-foreground">{form.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{form.description}</p>
                  <p className="text-xs text-primary font-semibold mt-2">Download here →</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* My Submissions */}
      <div>
        <h2 className="font-heading text-lg font-bold text-foreground mb-4">My Submissions ({submissions.length})</h2>
        <div className="bg-card rounded-xl shadow-card overflow-hidden">
          {submissions.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-muted-foreground">No submissions yet. Download a form and submit it above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b-2 border-border">
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">File</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((s) => {
                    const { data: urlData } = supabase.storage.from('submissions').getPublicUrl(s.file_path);
                    const statusColors = {
                      'submitted': 'bg-warning/10 text-warning',
                      'reviewed': 'bg-info/10 text-info',
                      'approved': 'bg-success/10 text-success',
                      'rejected': 'bg-destructive/10 text-destructive'
                    };
                    
                    return (
                      <tr key={s.id} className="border-b border-muted hover:bg-muted/30">
                        <td className="px-4 py-3">
                          {urlData?.publicUrl ? (
                            <a 
                              href={urlData.publicUrl} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="inline-flex items-center gap-2 text-primary font-semibold no-underline hover:underline"
                            >
                              <FileText className="w-4 h-4" /> {s.file_name}
                            </a>
                          ) : (
                            <span className="inline-flex items-center gap-2 text-muted-foreground">
                              <FileText className="w-4 h-4" /> {s.file_name}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{s.description || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${statusColors[s.status] || 'bg-muted text-muted-foreground'}`}>
                            {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3">
                          <button 
                            onClick={() => handleDelete(s)} 
                            className="text-destructive hover:text-destructive/80 bg-transparent border-none cursor-pointer p-1"
                            title="Delete submission"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserForms;