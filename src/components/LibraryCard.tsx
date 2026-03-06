import { useRef } from "react";
import { BookOpen, Printer } from "lucide-react";

interface LibraryCardProps {
  fullName: string;
  registrationNumber: string;
  email: string;
  photoUrl: string | null;
  memberId: string;
  memberSince: string;
}

const LibraryCard = ({ fullName, registrationNumber, email, photoUrl, memberId, memberSince }: LibraryCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = cardRef.current;
    if (!printContent) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Library Card - ${fullName}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f5f5f5; font-family: 'Segoe UI', system-ui, sans-serif; }
            .card { width: 340px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); border-radius: 16px; padding: 24px; color: white; position: relative; overflow: hidden; }
            .card::before { content: ''; position: absolute; top: -50%; right: -50%; width: 100%; height: 100%; background: radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%); }
            .header { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; position: relative; }
            .logo { width: 36px; height: 36px; background: white; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px; }
            .title { font-size: 16px; font-weight: 700; }
            .subtitle { font-size: 10px; opacity: 0.7; }
            .body { display: flex; gap: 16px; position: relative; }
            .photo { width: 80px; height: 100px; border-radius: 8px; object-fit: cover; border: 2px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.1); }
            .photo-placeholder { width: 80px; height: 100px; border-radius: 8px; border: 2px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 32px; }
            .info { flex: 1; }
            .name { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
            .reg { font-size: 11px; opacity: 0.85; margin-bottom: 8px; font-family: monospace; letter-spacing: 1px; }
            .field { margin-bottom: 6px; }
            .field-label { font-size: 8px; text-transform: uppercase; opacity: 0.5; letter-spacing: 1px; }
            .field-value { font-size: 11px; opacity: 0.9; }
            .footer { margin-top: 16px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.15); display: flex; justify-content: space-between; position: relative; }
            .footer-item .field-label { font-size: 8px; }
            .footer-item .field-value { font-size: 10px; }
            @media print { body { background: white; } }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <div class="logo">📚</div>
              <div>
                <div class="title">Athena Library</div>
                <div class="subtitle">Library Management System</div>
              </div>
            </div>
            <div class="body">
              ${photoUrl 
                ? `<img src="${photoUrl}" class="photo" crossorigin="anonymous" />`
                : `<div class="photo-placeholder">👤</div>`
              }
              <div class="info">
                <div class="name">${fullName}</div>
                <div class="reg">${registrationNumber}</div>
                <div class="field">
                  <div class="field-label">Email</div>
                  <div class="field-value">${email}</div>
                </div>
                <div class="field">
                  <div class="field-label">Status</div>
                  <div class="field-value">✅ Active Member</div>
                </div>
              </div>
            </div>
            <div class="footer">
              <div class="footer-item">
                <div class="field-label">Member ID</div>
                <div class="field-value">${memberId}</div>
              </div>
              <div class="footer-item">
                <div class="field-label">Member Since</div>
                <div class="field-value">${memberSince}</div>
              </div>
            </div>
          </div>
          <script>setTimeout(() => window.print(), 500);</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div className="space-y-4">
      {/* Card Preview */}
      <div
        ref={cardRef}
        className="w-full max-w-[340px] mx-auto rounded-2xl p-6 text-white relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }}
      >
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-[radial-gradient(circle,rgba(255,255,255,0.05)_0%,transparent_70%)]" />

        <div className="flex items-center gap-2.5 mb-5 relative">
          <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-[#1a1a2e]" />
          </div>
          <div>
            <div className="text-base font-bold">Athena Library</div>
            <div className="text-[10px] opacity-70">Library Management System</div>
          </div>
        </div>

        <div className="flex gap-4 relative">
          {photoUrl ? (
            <img src={photoUrl} alt={fullName} className="w-20 h-[100px] rounded-lg object-cover border-2 border-white/30" />
          ) : (
            <div className="w-20 h-[100px] rounded-lg border-2 border-white/30 bg-white/10 flex items-center justify-center text-3xl">
              👤
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-bold truncate">{fullName}</div>
            <div className="text-[11px] opacity-85 font-mono tracking-wider mb-2">{registrationNumber}</div>
            <div className="mb-1.5">
              <div className="text-[8px] uppercase opacity-50 tracking-wider">Email</div>
              <div className="text-[11px] opacity-90 truncate">{email}</div>
            </div>
            <div>
              <div className="text-[8px] uppercase opacity-50 tracking-wider">Status</div>
              <div className="text-[11px] opacity-90">✅ Active Member</div>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-white/15 flex justify-between relative">
          <div>
            <div className="text-[8px] uppercase opacity-50 tracking-wider">Member ID</div>
            <div className="text-[10px] opacity-90">{memberId}</div>
          </div>
          <div>
            <div className="text-[8px] uppercase opacity-50 tracking-wider">Member Since</div>
            <div className="text-[10px] opacity-90">{memberSince}</div>
          </div>
        </div>
      </div>

      {/* Print Button */}
      <div className="flex justify-center">
        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
        >
          <Printer className="w-4 h-4" />
          Print Library Card
        </button>
      </div>
    </div>
  );
};

export default LibraryCard;
