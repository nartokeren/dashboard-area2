'use client';

import React, { useState, useRef } from 'react';
import { startOfDay, endOfDay, isBefore, isAfter, isSameDay, isSameMonth } from 'date-fns';

interface TabelFulfillmentProps {
  filteredData: any[];
  dateFrom: string;
  dateTo: string;
  statusDateFrom: string;
  statusDateTo: string;
  regionalMapping: any;
  targetMapping: any;
  parseDate: (value: any) => Date | null;
  exportSection?: (elementId: string, fileName: string) => void;
}

export default function TabelFulfillment({
  filteredData,
  dateFrom,
  dateTo,
  statusDateFrom,
  statusDateTo,
  regionalMapping,
  targetMapping,
  parseDate,
  exportSection,
}: TabelFulfillmentProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<any[]>([]);
  const [modalTitle, setModalTitle] = useState('');
  const [modalType, setModalType] = useState<'detail' | 'summary'>('detail');
  const [showExportButton, setShowExportButton] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const summaryTableRef = useRef<HTMLTableElement>(null);
  const [copyFeedback, setCopyFeedback] = useState('');

  // ============================================
  // FUNGSI UNTUK CREATE SUMMARY DATA (AREA 2 atau PER REGIONAL)
  // ============================================
  const createSummaryData = (filterRegional?: string) => {
    const fromDate = dateFrom ? startOfDay(new Date(dateFrom)) : null;
    const toDate = dateTo ? endOfDay(new Date(dateTo)) : null;

    const dateFiltered = filteredData.filter((row: any) => {
      const dateCreated = parseDate(row['DATECREATED']);
      if (!dateCreated) return false;
      if (fromDate && isBefore(dateCreated, fromDate)) return false;
      if (toDate && isAfter(dateCreated, toDate)) return false;
      return row['STATUS'] === 'STARTWORK'; // Only STARTWORK
    });

    const regionalMap = new Map<string, Map<string, Map<string, any>>>();

    // Build hierarchical structure: REGIONAL -> BRANCH -> STO
    dateFiltered.forEach((row: any) => {
      const regional = regionalMapping[row['DISTRICT_TIF']] || 'LAINNYA';
      const branch = row['DISTRICT_TIF'] || 'UNKNOWN';
      const serviceArea = row['STO'] || 'UNKNOWN';
      const kategori = getKategoriManja(row);

      if (!regionalMap.has(regional)) {
        regionalMap.set(regional, new Map());
      }
      const branchMap = regionalMap.get(regional)!;

      if (!branchMap.has(branch)) {
        branchMap.set(branch, new Map());
      }
      const stoMap = branchMap.get(branch)!;

      if (!stoMap.has(serviceArea)) {
        stoMap.set(serviceArea, {
          serviceArea,
          manjaExp: 0,
          manjaHI: 0,
          manjaHPlus: 0,
          nonManja: 0,
        });
      }
      const stoData = stoMap.get(serviceArea)!;

      if (kategori === 'MANJA EXP') stoData.manjaExp++;
      else if (kategori === 'MANJA HI') stoData.manjaHI++;
      else if (kategori === 'MANJA H+') stoData.manjaHPlus++;
      else if (kategori === 'NON MANJA') stoData.nonManja++;
    });

    // Build summary structure
    const summary: any[] = [];
    const regionalOrder = ['BANTEN', 'EASTERN JABOTABEK', 'JAKARTA', 'JAWA BARAT'];
    const regionsToProcess = filterRegional ? [filterRegional] : regionalOrder;

    regionsToProcess.forEach((regional) => {
      const branchMap = regionalMap.get(regional);
      if (!branchMap) return;

      let regionalManjaExp = 0,
        regionalManjaHI = 0,
        regionalManjaHPlus = 0,
        regionalNonManja = 0;

      const branches: any[] = [];

      branchMap.forEach((stoMap, branch) => {
        let branchManjaExp = 0,
          branchManjaHI = 0,
          branchManjaHPlus = 0,
          branchNonManja = 0;
        const serviceAreas: any[] = [];

        stoMap.forEach((stoData) => {
          serviceAreas.push(stoData);
          branchManjaExp += stoData.manjaExp;
          branchManjaHI += stoData.manjaHI;
          branchManjaHPlus += stoData.manjaHPlus;
          branchNonManja += stoData.nonManja;
        });

        branches.push({
          type: 'branch',
          regional,
          branch,
          serviceAreas,
          manjaExp: branchManjaExp,
          manjaHI: branchManjaHI,
          manjaHPlus: branchManjaHPlus,
          nonManja: branchNonManja,
        });

        regionalManjaExp += branchManjaExp;
        regionalManjaHI += branchManjaHI;
        regionalManjaHPlus += branchManjaHPlus;
        regionalNonManja += branchNonManja;
      });

      summary.push({
        type: 'regional',
        regional,
        branches,
        manjaExp: regionalManjaExp,
        manjaHI: regionalManjaHI,
        manjaHPlus: regionalManjaHPlus,
        nonManja: regionalNonManja,
      });
    });

    return summary;
  };

  // ============================================
  // FUNGSI TOGGLE EXPAND ROW
  // ============================================
  const toggleExpandRow = (key: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedRows(newExpanded);
  };

  // ============================================
  // FUNGSI EXPORT SUMMARY TABLE
  // ============================================
  const exportSummaryTable = async () => {
    if (!summaryTableRef.current) return;

    try {
      // Dynamic import html2canvas
      const html2canvas = (await import('html2canvas')).default;

      // Create a clean, simple copy of the table without Tailwind classes
      const clonedTable = summaryTableRef.current.cloneNode(true) as HTMLTableElement;
      
      // Remove all Tailwind classes and apply inline styles instead
      const styleSheet = document.createElement('style');
      styleSheet.textContent = `
        table { 
          width: 100%; 
          border-collapse: collapse; 
          font-family: Arial, sans-serif; 
          font-size: 12px;
        }
        thead { 
          background-color: #1e293b; 
          color: #ffffff; 
        }
        th { 
          border: 1px solid #334155; 
          padding: 10px; 
          text-align: left; 
          font-weight: bold; 
          font-size: 13px;
          color: #ffffff;
          background-color: #1e293b;
        }
        td { 
          border: 1px solid #cbd5e1; 
          padding: 10px; 
          font-size: 12px;
          color: #000000;
        }
        tbody tr:nth-child(odd) { 
          background-color: #f1f5f9; 
        }
        tbody tr:nth-child(even) { 
          background-color: #ffffff; 
        }
      `;

      // Create temporary container
      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '-9999px';
      tempContainer.style.background = 'white';
      tempContainer.style.padding = '20px';
      tempContainer.style.width = '800px';
      
      // Remove all class attributes to avoid Tailwind
      clonedTable.querySelectorAll('*').forEach((el) => {
        el.removeAttribute('class');
      });
      
      tempContainer.appendChild(styleSheet);
      tempContainer.appendChild(clonedTable);
      document.body.appendChild(tempContainer);

      // Capture canvas
      const canvas = await html2canvas(tempContainer, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true,
      });

      // Remove temporary container
      document.body.removeChild(tempContainer);

      // Download image
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `Summary_ORDER_PI_${new Date().toISOString().split('T')[0]}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export gagal, silakan coba lagi');
    }
  };

  // ============================================
  // FUNGSI COPY TO CLIPBOARD
  // ============================================
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback('✓ Copied!');
      setTimeout(() => setCopyFeedback(''), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
      setCopyFeedback('✗ Copy failed');
    }
  };

  // ============================================
  // FUNGSI GENERATE SUMMARY REPORT
  // ============================================
  const generateSummaryReport = (area2Data: any, regionalArray: any[], branchArray: any[]) => {
    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    
    // Header summary
    const headerSummary = `Posisi Jam ${timeStr}, PS : ${area2Data.psHI}, Acomp + Inscomp + Valstart + Valcomp : ${area2Data.totalInprogress}, dan Manja Exp + Manja HI + Non Manja + Manja H+ : ${area2Data.totalOrderPI}`;
    
    // Regional summary
    let regionalSummary = 'REGIONAL TABLE\nNO | REGIONAL | PS HI | TGT PS 2.3K | DEV TGT\n';
    const sortedRegional = [...regionalArray]
      .filter((item: any) => item.isSubTotal)
      .sort((a: any, b: any) => b.psHI - a.psHI)
      .map((item: any, idx: number) => `${idx + 1} | ${item.regional} | ${item.psHI} | ${item.tgtPSHI?.toLocaleString() || '0'} | ${(item.devHI).toLocaleString()}`);
    regionalSummary += sortedRegional.join('\n');
    
    // Branch summary
    let branchSummary = '\nBRANCH TABLE\nNO | BRANCH | PS HI | TGT PS 2.3K | DEV TGT\n';
    const sortedBranch = [...branchArray]
      .filter((item: any) => !item.isSubTotal && !item.isArea2)
      .sort((a: any, b: any) => b.psHI - a.psHI)
      .map((item: any, idx: number) => `${idx + 1} | ${item.branch} | ${item.psHI} | ${item.tgtPSHI?.toLocaleString() || '0'} | ${(item.devHI).toLocaleString()}`);
    branchSummary += sortedBranch.join('\n');
    
    // Add AREA 2 total at the end
    branchSummary += `\n# | AREA 2 | ${area2Data.psHI} | ${area2Data.tgtPSHI?.toLocaleString() || '0'} | ${(area2Data.devHI).toLocaleString()}`;
    
    return { headerSummary, regionalSummary, branchSummary, fullSummary: headerSummary + '\n\n' + regionalSummary + branchSummary };
  };

  // ============================================
  // FUNGSI UNTUK PREPARE MODAL SUMMARY (AREA 2 atau PER REGIONAL)
  // ============================================
  const openModalSummary = (regionalName?: string) => {
    const summaryData = createSummaryData(regionalName);
    setModalData(summaryData);
    setModalTitle(regionalName ? `Summary ORDER PI - ${regionalName}` : 'Summary ORDER PI - AREA 2');
    setModalType('summary');
    setShowExportButton(!!regionalName); // Show export only for regional summary (SUB TOTAL)
    setExpandedRows(new Set());
    setModalOpen(true);
  };

  // ============================================
  // FUNGSI HELPER KATEGORI MANJA
  // ============================================
  const getKategoriManja = (row: any) => {
    const status = row['STATUS'] || '';
    const tglManja = parseDate(row['TGL_MANJA']);

    if (status === 'STARTWORK' && tglManja) {
      const tglManjaDate = startOfDay(tglManja);
      const todayDate = startOfDay(new Date());
      
      if (isBefore(tglManjaDate, todayDate)) return 'MANJA EXP';
      else if (isSameDay(tglManjaDate, todayDate)) return 'MANJA HI';
      else if (isAfter(tglManjaDate, todayDate)) return 'MANJA H+';
    } else if (status === 'STARTWORK' && !tglManja) {
      return 'NON MANJA';
    }
    
    return row['KATEGORI_MANJA'] || 'NON MANJA';
  };

  // ============================================
  // FUNGSI UNTUK PREPARE MODAL DATA (DETAIL)
  // ============================================
  const openModalDetail = (branchName: string) => {
    const fromDate = dateFrom ? startOfDay(new Date(dateFrom)) : null;
    const toDate = dateTo ? endOfDay(new Date(dateTo)) : null;

    const dateFiltered = filteredData.filter((row: any) => {
      const dateCreated = parseDate(row['DATECREATED']);
      if (!dateCreated) return false;
      if (fromDate && isBefore(dateCreated, fromDate)) return false;
      if (toDate && isAfter(dateCreated, toDate)) return false;
      return row['STATUS'] === 'STARTWORK'; // Only STARTWORK
    });

    let branchFiltered = dateFiltered.filter((row: any) => row['DISTRICT_TIF'] === branchName);

    const detailData = branchFiltered.map((row: any) => ({
      BRANCH: row['DISTRICT_TIF'] || '-',
      STO: row['STO'] || '-',
      WONUM: row['WONUM'] || '-',
      KATEGORI_MANJA: getKategoriManja(row),
    }));

    setModalData(detailData);
    setModalTitle(`Detail ORDER PI - ${branchName}`);
    setModalType('detail');
    setShowExportButton(false);
    setModalOpen(true);
  };

  // ============================================
  // HITUNG DATA
  // ============================================
  const calculateBranchData = () => {
    const fromDate = dateFrom ? startOfDay(new Date(dateFrom)) : null;
    const toDate = dateTo ? endOfDay(new Date(dateTo)) : null;

    const dateFiltered = filteredData.filter((row: any) => {
      const dateCreated = parseDate(row['DATECREATED']);
      if (!dateCreated) return false;
      if (fromDate && isBefore(dateCreated, fromDate)) return false;
      if (toDate && isAfter(dateCreated, toDate)) return false;
      return true;
    });

    const statusFrom = statusDateFrom ? startOfDay(new Date(statusDateFrom)) : null;
    const statusTo = statusDateTo ? endOfDay(new Date(statusDateTo)) : null;

    const statusDateFiltered = filteredData.filter((row: any) => {
      const statusDate = parseDate(row['STATUSDATE']);
      if (!statusDate) return false;
      if (statusFrom && isBefore(statusDate, statusFrom)) return false;
      if (statusTo && isAfter(statusDate, statusTo)) return false;
      return true;
    });

    const totalRE = dateFiltered.length;
    const totalPS = statusDateFiltered.filter((row: any) => row['STATUS'] === 'COMPWORK').length;
    const totalCANCEL = dateFiltered.filter((row: any) => row['STATUS'] === 'CANCLWORK').length;
    const totalKendalaTeknik = dateFiltered.filter((row: any) => 
      row['STATUS'] === 'WORKFAIL' && 
      (row['ERRORCODE_AKHIR'] === 'KENDALA TEKNIK' || row['ERRORCODE_AKHIR'] === 'KENDALA TEKNIS')
    ).length;
    const totalKendalaPelanggan = dateFiltered.filter((row: any) => 
      row['STATUS'] === 'WORKFAIL' && 
      row['ERRORCODE_AKHIR'] === 'KENDALA PELANGGAN'
    ).length;
    const totalKendalaLainnya = dateFiltered.filter((row: any) => 
      row['STATUS'] === 'WORKFAIL' && 
      row['ERRORCODE_AKHIR'] === 'KENDALA LAINNYA'
    ).length;
    const psRePercent = totalRE > 0 ? (totalPS / totalRE) * 100 : 0;

    const combinedMap = new Map();
    [...dateFiltered, ...statusDateFiltered].forEach((row: any) => {
      const wonum = row['WONUM'] || '';
      if (!combinedMap.has(wonum)) combinedMap.set(wonum, row);
    });
    const allData = Array.from(combinedMap.values());

    const branchMap = new Map<string, any>();
    allData.forEach((row: any) => {
      const branch = row['DISTRICT_TIF'] || 'UNKNOWN';
      const regional = regionalMapping[branch] || 'LAINNYA';
      const status = row['STATUS'] || '';
      const dateCreated = parseDate(row['DATECREATED']);
      const statusDate = parseDate(row['STATUSDATE']);
      const tglManja = parseDate(row['TGL_MANJA']);

      if (!branchMap.has(branch)) {
        branchMap.set(branch, {
          branch, regional,
          manjaExp: 0, manjaHI: 0, manjaHPlus: 0, nonManja: 0,
          workfail: 0, contwork: 0, instcomp: 0,
          actcomp: 0, valstart: 0, valcomp: 0,
          psHI: 0, reHI: 0, psMTD: 0, reMTD: 0,
        });
      }
      const bd = branchMap.get(branch);

      if (status === 'STARTWORK' && tglManja) {
        const tglManjaDate = startOfDay(tglManja);
        const todayDate = startOfDay(new Date());
        if (isBefore(tglManjaDate, todayDate)) bd.manjaExp++;
        else if (isSameDay(tglManjaDate, todayDate)) bd.manjaHI++;
        else if (isAfter(tglManjaDate, todayDate)) bd.manjaHPlus++;
      } else if (status === 'STARTWORK' && !tglManja) {
        bd.nonManja++;
      }

      if (status === 'WORKFAIL' && dateCreated && isSameMonth(dateCreated, new Date())) bd.workfail++;
      if (status === 'CONTWORK' && statusDate && isSameDay(statusDate, new Date())) bd.contwork++;
      if (status === 'INSTCOMP' && statusDate && isSameDay(statusDate, new Date())) bd.instcomp++;
      if (status === 'ACTCOMP' && statusDate && isSameDay(statusDate, new Date())) bd.actcomp++;
      if (status === 'VALSTART' && statusDate && isSameDay(statusDate, new Date())) bd.valstart++;
      if (status === 'VALCOMP' && statusDate && isSameDay(statusDate, new Date())) bd.valcomp++;

      if (status === 'COMPWORK' && statusDate && isSameDay(statusDate, new Date())) bd.psHI++;
      if (dateCreated && isSameDay(dateCreated, new Date())) bd.reHI++;

      // PS MTD (FILTER STATUSDATE)
      if (status === 'COMPWORK' && statusDate) {
        const sFrom = statusDateFrom ? startOfDay(new Date(statusDateFrom)) : null;
        const sTo = statusDateTo ? endOfDay(new Date(statusDateTo)) : null;
        let match = true;
        if (sFrom && isBefore(statusDate, sFrom)) match = false;
        if (sTo && isAfter(statusDate, sTo)) match = false;
        if (match) bd.psMTD++;
      }

      // RE MTD (FILTER DATECREATED)
      if (dateCreated) {
        const dFrom = dateFrom ? startOfDay(new Date(dateFrom)) : null;
        const dTo = dateTo ? endOfDay(new Date(dateTo)) : null;
        let match = true;
        if (dFrom && isBefore(dateCreated, dFrom)) match = false;
        if (dTo && isAfter(dateCreated, dTo)) match = false;
        if (match) bd.reMTD++;
      }
    });

    const branchArray = Array.from(branchMap.values()).map((item: any) => {
      const totalOrderPI = item.manjaExp + item.manjaHI + item.manjaHPlus + item.nonManja;
      const totalFallout = item.workfail + item.contwork + item.instcomp;
      const totalInprogress = item.actcomp + item.valstart + item.valcomp;
      const psReHI = item.reHI > 0 ? (item.psHI / item.reHI) * 100 : 0;
      const potensiPS = item.psHI + totalInprogress;
      const potensiPsRe = item.reHI > 0 ? (potensiPS / item.reHI) * 100 : 0;
      const psReMTD = item.reMTD > 0 ? (item.psMTD / item.reMTD) * 100 : 0;

      const tgtPSHI = targetMapping[item.branch] || 0;
      const devHI = item.psHI - tgtPSHI;
      const achHI = tgtPSHI > 0 ? (item.psHI / tgtPSHI) * 100 : 0;
      const checkHI = item.psHI >= tgtPSHI ? '✅' : '❌';

      const dayOfMonth = new Date().getDate();
      const tgtPSMTD = tgtPSHI * dayOfMonth;
      const devMTD = item.psMTD - tgtPSMTD;
      const achMTD = tgtPSMTD > 0 ? (item.psMTD / tgtPSMTD) * 100 : 0;
      const checkMTD = item.psMTD >= tgtPSMTD ? '✅' : '❌';

      return {
        ...item,
        totalOrderPI,
        totalFallout,
        totalInprogress,
        potensiPS,
        psReHI,
        potensiPsRe,
        psReMTD,
        tgtPSHI,
        devHI,
        achHI,
        checkHI,
        tgtPSMTD,
        devMTD,
        achMTD,
        checkMTD,
      };
    });

    const finalData: any[] = [];
    const regionalOrder = ['BANTEN', 'EASTERN JABOTABEK', 'JAKARTA', 'JAWA BARAT'];
    const regionalMap = new Map<string, any[]>();
    branchArray.forEach((item: any) => {
      const reg = item.regional || 'LAINNYA';
      if (!regionalMap.has(reg)) regionalMap.set(reg, []);
      regionalMap.get(reg)!.push(item);
    });

    let grandTotal: any = {
      manjaExp: 0, manjaHI: 0, manjaHPlus: 0, nonManja: 0,
      workfail: 0, contwork: 0, instcomp: 0,
      actcomp: 0, valstart: 0, valcomp: 0,
      psHI: 0, reHI: 0, psMTD: 0, reMTD: 0,
    };

    regionalOrder.forEach(reg => {
      const branches = regionalMap.get(reg) || [];
      if (branches.length === 0) return;

      const subTotal: any = {
        branch: 'SUB TOTAL',
        regional: reg,
        isSubTotal: true,
        manjaExp: 0, manjaHI: 0, manjaHPlus: 0, nonManja: 0,
        workfail: 0, contwork: 0, instcomp: 0,
        actcomp: 0, valstart: 0, valcomp: 0,
        psHI: 0, reHI: 0, psMTD: 0, reMTD: 0,
      };

      branches.forEach((item: any) => {
        subTotal.manjaExp += item.manjaExp;
        subTotal.manjaHI += item.manjaHI;
        subTotal.manjaHPlus += item.manjaHPlus;
        subTotal.nonManja += item.nonManja;
        subTotal.workfail += item.workfail;
        subTotal.contwork += item.contwork;
        subTotal.instcomp += item.instcomp;
        subTotal.actcomp += item.actcomp;
        subTotal.valstart += item.valstart;
        subTotal.valcomp += item.valcomp;
        subTotal.psHI += item.psHI;
        subTotal.reHI += item.reHI;
        subTotal.psMTD += item.psMTD;
        subTotal.reMTD += item.reMTD;

        grandTotal.manjaExp += item.manjaExp;
        grandTotal.manjaHI += item.manjaHI;
        grandTotal.manjaHPlus += item.manjaHPlus;
        grandTotal.nonManja += item.nonManja;
        grandTotal.workfail += item.workfail;
        grandTotal.contwork += item.contwork;
        grandTotal.instcomp += item.instcomp;
        grandTotal.actcomp += item.actcomp;
        grandTotal.valstart += item.valstart;
        grandTotal.valcomp += item.valcomp;
        grandTotal.psHI += item.psHI;
        grandTotal.reHI += item.reHI;
        grandTotal.psMTD += item.psMTD;
        grandTotal.reMTD += item.reMTD;
      });

      subTotal.totalOrderPI = subTotal.manjaExp + subTotal.manjaHI + subTotal.manjaHPlus + subTotal.nonManja;
      subTotal.totalFallout = subTotal.workfail + subTotal.contwork + subTotal.instcomp;
      subTotal.totalInprogress = subTotal.actcomp + subTotal.valstart + subTotal.valcomp;
      subTotal.psReHI = subTotal.reHI > 0 ? (subTotal.psHI / subTotal.reHI) * 100 : 0;
      subTotal.potensiPS = subTotal.psHI + subTotal.totalInprogress;
      subTotal.potensiPsRe = subTotal.reHI > 0 ? (subTotal.potensiPS / subTotal.reHI) * 100 : 0;
      subTotal.psReMTD = subTotal.reMTD > 0 ? (subTotal.psMTD / subTotal.reMTD) * 100 : 0;

      let subTotalTgt = 0;
      branches.forEach((item: any) => {
        subTotalTgt += (item.tgtPSHI || 0);
      });
      subTotal.tgtPSHI = subTotalTgt;
      subTotal.devHI = subTotal.psHI - subTotalTgt;
      subTotal.achHI = subTotalTgt > 0 ? (subTotal.psHI / subTotalTgt) * 100 : 0;
      subTotal.checkHI = subTotal.psHI >= subTotalTgt ? '✅' : '❌';

      const dayOfMonth = new Date().getDate();
      subTotal.tgtPSMTD = subTotalTgt * dayOfMonth;
      subTotal.devMTD = subTotal.psMTD - subTotal.tgtPSMTD;
      subTotal.achMTD = subTotal.tgtPSMTD > 0 ? (subTotal.psMTD / subTotal.tgtPSMTD) * 100 : 0;
      subTotal.checkMTD = subTotal.psMTD >= subTotal.tgtPSMTD ? '✅' : '❌';

      branches.forEach((item: any) => {
        finalData.push({ ...item, isSubTotal: false });
      });
      finalData.push(subTotal);
    });

    const area2: any = {
      branch: 'AREA 2',
      regional: 'GRAND TOTAL',
      isArea2: true,
      manjaExp: grandTotal.manjaExp,
      manjaHI: grandTotal.manjaHI,
      manjaHPlus: grandTotal.manjaHPlus,
      nonManja: grandTotal.nonManja,
      workfail: grandTotal.workfail,
      contwork: grandTotal.contwork,
      instcomp: grandTotal.instcomp,
      actcomp: grandTotal.actcomp,
      valstart: grandTotal.valstart,
      valcomp: grandTotal.valcomp,
      psHI: grandTotal.psHI,
      reHI: grandTotal.reHI,
      psMTD: grandTotal.psMTD,
      reMTD: grandTotal.reMTD,
    };
    area2.totalOrderPI = area2.manjaExp + area2.manjaHI + area2.manjaHPlus + area2.nonManja;
    area2.totalFallout = area2.workfail + area2.contwork + area2.instcomp;
    area2.totalInprogress = area2.actcomp + area2.valstart + area2.valcomp;
    area2.psReHI = area2.reHI > 0 ? (area2.psHI / area2.reHI) * 100 : 0;
    area2.potensiPS = area2.psHI + area2.totalInprogress;
    area2.potensiPsRe = area2.reHI > 0 ? (area2.potensiPS / area2.reHI) * 100 : 0;
    area2.psReMTD = area2.reMTD > 0 ? (area2.psMTD / area2.reMTD) * 100 : 0;

    let area2Tgt = 0;
    branchArray.forEach((item: any) => {
      area2Tgt += (item.tgtPSHI || 0);
    });
    area2.tgtPSHI = area2Tgt;
    area2.devHI = area2.psHI - area2Tgt;
    area2.achHI = area2Tgt > 0 ? (area2.psHI / area2Tgt) * 100 : 0;
    area2.checkHI = area2.psHI >= area2Tgt ? '✅' : '❌';

    const dayOfMonth = new Date().getDate();
    area2.tgtPSMTD = area2Tgt * dayOfMonth;
    area2.devMTD = area2.psMTD - area2.tgtPSMTD;
    area2.achMTD = area2.tgtPSMTD > 0 ? (area2.psMTD / area2.tgtPSMTD) * 100 : 0;
    area2.checkMTD = area2.psMTD >= area2.tgtPSMTD ? '✅' : '❌';

    finalData.push(area2);

    return {
      totalRE,
      totalPS,
      totalCANCEL,
      totalKendalaTeknik,
      totalKendalaPelanggan,
      totalKendalaLainnya,
      psRePercent,
      branchArray: finalData,
    };
  };

  const result = calculateBranchData();

  if (filteredData.length === 0 || result.branchArray.length === 0) {
    return null;
  }

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="bg-white p-3 rounded-lg shadow-md overflow-x-auto mb-6 relative" id="table-container">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-sm font-bold text-slate-800">📋 (New Sales) Fulfillment Endstate AREA 2</h2>
        {exportSection && (
          <button
            onClick={() => exportSection('tabel-fulfillment', 'Fulfillment_Endstate')}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-1 px-3 rounded-lg transition"
          >
            🖼️ Export PNG
          </button>
        )}
      </div>
      <table className="w-full text-[10px] border-collapse">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th rowSpan={3} className="border border-slate-600 p-1 text-left font-bold align-middle">REGIONAL</th>
            <th rowSpan={3} className="border border-slate-600 p-1 text-left font-bold align-middle">BRANCH</th>
            <th rowSpan={2} colSpan={5} className="border border-slate-600 p-1 text-center font-bold bg-slate-700">ORDER PI</th>
            <th colSpan={4} className="border border-slate-600 p-1 text-center font-bold bg-slate-700">FALLOUT ORDER</th>
            <th colSpan={4} className="border border-slate-600 p-1 text-center font-bold bg-slate-700">INPROGRESS ORDER</th>
            <th colSpan={8} className="border border-slate-600 p-1 text-center font-bold bg-slate-700">PS TO RE</th>
            <th rowSpan={2} colSpan={4} className="border border-slate-600 p-1 text-center font-bold bg-slate-700">PS TO TARGET HI</th>
            <th rowSpan={2} colSpan={4} className="border border-slate-600 p-1 text-center font-bold bg-slate-700">PS TO TARGET MTD</th>
          </tr>
          <tr className="bg-slate-600 text-white">
            <th colSpan={3} className="border border-slate-500 p-0.5 text-center font-semibold">STATUS</th>
            <th rowSpan={2} className="border border-slate-500 p-0.5 text-center font-semibold align-middle">TOTAL</th>
            <th colSpan={3} className="border border-slate-500 p-0.5 text-center font-semibold">STATUS</th>
            <th rowSpan={2} className="border border-slate-500 p-0.5 text-center font-semibold align-middle">TOTAL</th>
            <th colSpan={3} className="border border-slate-500 p-0.5 text-center font-semibold">REALISASI PS/RE HI</th>
            <th colSpan={2} className="border border-slate-500 p-0.5 text-center font-semibold">POTENSI HI</th>
            <th colSpan={3} className="border border-slate-500 p-0.5 text-center font-semibold">MTD</th>
          </tr>
          <tr className="bg-slate-600 text-white">
            <th className="border border-slate-500 p-0.5 text-center font-semibold">MANJA EXP</th>
            <th className="border border-slate-500 p-0.5 text-center font-semibold">MANJA HI</th>
            <th className="border border-slate-500 p-0.5 text-center font-semibold">MANJA H+</th>
            <th className="border border-slate-500 p-0.5 text-center font-semibold">NON MANJA</th>
            <th className="border border-slate-500 p-0.5 text-center font-semibold">TOTAL</th>
            <th className="border border-slate-500 p-0.5 text-center font-semibold">WORKFAIL</th>
            <th className="border border-slate-500 p-0.5 text-center font-semibold">CONTWORK</th>
            <th className="border border-slate-500 p-0.5 text-center font-semibold">INSTCOMP</th>
            <th className="border border-slate-500 p-0.5 text-center font-semibold">ACTCOMP</th>
            <th className="border border-slate-500 p-0.5 text-center font-semibold">VALSTART</th>
            <th className="border border-slate-500 p-0.5 text-center font-semibold">VALCOMP</th>
            <th className="border border-slate-500 p-0.5 text-center font-semibold">PS HI</th>
            <th className="border border-slate-500 p-0.5 text-center font-semibold">RE HI</th>
            <th className="border border-slate-500 p-0.5 text-center font-semibold">PS/RE HI</th>
            <th className="border border-slate-500 p-0.5 text-center font-semibold">PS</th>
            <th className="border border-slate-500 p-0.5 text-center font-semibold">PS/RE</th>
            <th className="border border-slate-500 p-0.5 text-center font-semibold">RE</th>
            <th className="border border-slate-500 p-0.5 text-center font-semibold">PS</th>
            <th className="border border-slate-500 p-0.5 text-center font-semibold">PS/RE</th>
            <th className="border border-slate-500 p-0.5 text-center font-semibold">Tgt PS 2.3K</th>
            <th className="border border-slate-500 p-0.5 text-center font-semibold">DEV</th>
            <th className="border border-slate-500 p-0.5 text-center font-semibold">ACH</th>
            <th className="border border-slate-500 p-0.5 text-center font-semibold">CHECK</th>
            <th className="border border-slate-500 p-0.5 text-center font-semibold">Tgt PS MTD</th>
            <th className="border border-slate-500 p-0.5 text-center font-semibold">DEV</th>
            <th className="border border-slate-500 p-0.5 text-center font-semibold">ACH</th>
            <th className="border border-slate-500 p-0.5 text-center font-semibold">CHECK</th>
          </tr>
        </thead>
        <tbody>
          {(() => {
            const rowsWithSpan: any[] = [];
            let lastRegional = '';
            let regionalCount = 0;

            result.branchArray.forEach((item: any, idx: number) => {
              const isSubTotal = item.isSubTotal === true;
              const isArea2 = item.isArea2 === true;

              if (!isArea2) {
                if (item.regional !== lastRegional) {
                  regionalCount = 1;
                  lastRegional = item.regional;
                  for (let i = idx + 1; i < result.branchArray.length; i++) {
                    const next = result.branchArray[i];
                    if (next.isArea2) break;
                    if (next.regional === item.regional) regionalCount++;
                    else break;
                  }
                }
              }

              rowsWithSpan.push({
                ...item,
                idx,
                isSubTotal,
                isArea2,
                regionalCount: isArea2 ? 1 : (item.regional === lastRegional ? regionalCount : 1),
                isFirstInRegional: !isArea2 && item.regional === lastRegional && (idx === 0 || result.branchArray[idx - 1]?.regional !== item.regional),
              });
            });

            return rowsWithSpan.map((item: any) => {
              const rowColor = item.idx % 2 === 0 ? 'bg-white' : 'bg-slate-50';
              const isSubTotal = item.isSubTotal === true;
              const isArea2 = item.isArea2 === true;
              let bgColor = rowColor;
              if (isSubTotal) bgColor = 'bg-blue-100';
              if (isArea2) bgColor = 'bg-slate-800 text-white';

              const psReHI = item.psReHI ?? 0;
              const potensiPsRe = item.potensiPsRe ?? 0;
              const psReMTD = item.psReMTD ?? 0;
              const achHI = item.achHI ?? 0;
              const achMTD = item.achMTD ?? 0;
              const devHI = item.devHI ?? 0;
              const devMTD = item.devMTD ?? 0;

              return (
                <tr key={item.idx} className={`${bgColor} hover:bg-blue-50 transition-colors`}>
                  {isArea2 ? (
                    <td colSpan={2} className="border border-slate-300 p-1 font-bold text-white text-center bg-slate-800">AREA 2</td>
                  ) : (
                    <>
                      {item.isFirstInRegional ? (
                        <td rowSpan={item.regionalCount} className={`border border-slate-300 p-1 font-bold ${isSubTotal ? 'text-slate-800' : 'text-slate-800'}`}>
                          {isSubTotal ? '' : item.regional}
                        </td>
                      ) : null}
                      <td className={`border border-slate-300 p-1 font-semibold ${isSubTotal ? 'text-slate-700' : 'text-slate-700'}`}>
                        {isSubTotal ? 'SUB TOTAL' : item.branch}
                      </td>
                    </>
                  )}

                  <td className={`border border-slate-300 p-1 text-center font-mono ${isArea2 ? 'text-white' : (item.manjaExp > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold')}`}>{item.manjaExp}</td>
                  <td className={`border border-slate-300 p-1 text-center font-mono ${isArea2 ? 'text-white' : (item.manjaHI > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold')}`}>{item.manjaHI}</td>
                  <td className={`border border-slate-300 p-1 text-center font-mono ${isArea2 ? 'text-white' : (item.manjaHPlus > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold')}`}>{item.manjaHPlus}</td>
                  <td className={`border border-slate-300 p-1 text-center font-mono ${isArea2 ? 'text-white' : (item.nonManja > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold')}`}>{item.nonManja}</td>
                  <td 
                    onClick={() => {
                      if (isArea2) openModalSummary();
                      else if (isSubTotal) openModalSummary(item.regional);
                      else openModalDetail(item.branch);
                    }}
                    className={`border border-slate-300 p-1 text-center font-bold font-mono ${isArea2 ? 'cursor-pointer hover:bg-blue-200' : 'cursor-pointer hover:bg-blue-200'} transition ${isArea2 ? 'text-white' : 'text-blue-600'}`}
                  >
                    {item.totalOrderPI}
                  </td>

                  <td className={`border border-slate-300 p-1 text-center font-mono ${isArea2 ? 'text-white' : (item.workfail > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold')}`}>{item.workfail}</td>
                  <td className={`border border-slate-300 p-1 text-center font-mono ${isArea2 ? 'text-white' : (item.contwork > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold')}`}>{item.contwork}</td>
                  <td className={`border border-slate-300 p-1 text-center font-mono ${isArea2 ? 'text-white' : (item.instcomp > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold')}`}>{item.instcomp}</td>
                  <td className={`border border-slate-300 p-1 text-center font-bold font-mono ${isArea2 ? 'text-white' : 'text-blue-600'}`}>{item.totalFallout}</td>

                  <td className={`border border-slate-300 p-1 text-center font-mono ${isArea2 ? 'text-white' : (item.actcomp > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold')}`}>{item.actcomp}</td>
                  <td className={`border border-slate-300 p-1 text-center font-mono ${isArea2 ? 'text-white' : (item.valstart > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold')}`}>{item.valstart}</td>
                  <td className={`border border-slate-300 p-1 text-center font-mono ${isArea2 ? 'text-white' : (item.valcomp > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold')}`}>{item.valcomp}</td>
                  <td className={`border border-slate-300 p-1 text-center font-bold font-mono ${isArea2 ? 'text-white' : 'text-blue-600'}`}>{item.totalInprogress}</td>

                  <td className={`border border-slate-300 p-1 text-center font-mono ${isArea2 ? 'text-white' : 'text-black'}`}>{item.psHI}</td>
                  <td className={`border border-slate-300 p-1 text-center font-mono ${isArea2 ? 'text-white' : 'text-black'}`}>{item.reHI}</td>
                  <td className={`border border-slate-300 p-1 text-center font-mono font-bold ${isArea2 ? 'text-white' : (psReHI >= 85 ? 'text-green-600' : 'text-red-600')}`}>{psReHI.toFixed(2)}%</td>
                  <td className={`border border-slate-300 p-1 text-center font-mono ${isArea2 ? 'text-white' : 'text-black'}`}>{item.potensiPS}</td>
                  <td className={`border border-slate-300 p-1 text-center font-mono font-bold ${isArea2 ? 'text-white' : (potensiPsRe >= 85 ? 'text-green-600' : 'text-red-600')}`}>{potensiPsRe.toFixed(2)}%</td>
                  <td className={`border border-slate-300 p-1 text-center font-mono ${isArea2 ? 'text-white' : 'text-black'}`}>{item.reMTD}</td>
                  <td className={`border border-slate-300 p-1 text-center font-mono font-semibold ${isArea2 ? 'text-white' : 'text-black'}`}>{item.psMTD}</td>
                  <td className={`border border-slate-300 p-1 text-center font-mono font-bold ${isArea2 ? 'text-white' : (psReMTD >= 85 ? 'text-green-600' : 'text-red-600')}`}>{psReMTD.toFixed(2)}%</td>

                  <td className={`border border-slate-300 p-1 text-center font-mono ${isArea2 ? 'text-white' : 'text-black'}`}>{item.tgtPSHI?.toLocaleString() || '0'}</td>
                  <td className={`border border-slate-300 p-1 text-center font-mono font-semibold ${isArea2 ? 'text-white' : (devHI < 0 ? 'text-red-600' : 'text-black')}`}>{devHI.toLocaleString()}</td>
                  <td className={`border border-slate-300 p-1 text-center font-mono font-semibold ${isArea2 ? 'text-white' : (achHI < 60 ? 'text-red-600' : achHI <= 80 ? 'text-yellow-600' : 'text-green-600')}`}>{achHI.toFixed(2)}%</td>
                  <td className={`border border-slate-300 p-1 text-center text-lg font-bold ${isArea2 ? 'text-white' : 'text-black'}`}>{item.checkHI || '❌'}</td>

                  <td className={`border border-slate-300 p-1 text-center font-mono ${isArea2 ? 'text-white' : 'text-black'}`}>{item.tgtPSMTD?.toLocaleString() || '0'}</td>
                  <td className={`border border-slate-300 p-1 text-center font-mono font-semibold ${isArea2 ? 'text-white' : (devMTD < 0 ? 'text-red-600' : 'text-black')}`}>{devMTD.toLocaleString()}</td>
                  <td className={`border border-slate-300 p-1 text-center font-mono font-semibold ${isArea2 ? 'text-white' : (achMTD < 60 ? 'text-red-600' : achMTD <= 80 ? 'text-yellow-600' : 'text-green-600')}`}>{achMTD.toFixed(2)}%</td>
                  <td className={`border border-slate-300 p-1 text-center text-lg font-bold ${isArea2 ? 'text-white' : 'text-black'}`}>{item.checkMTD || '❌'}</td>
                </tr>
              );
            });
          })()}
        </tbody>
      </table>

      {/* SUMMARY SECTION */}
      {(() => {
        const area2Row = result.branchArray.find((item: any) => item.isArea2);
        if (!area2Row) return null;
        
        const summaries = generateSummaryReport(area2Row, result.branchArray, result.branchArray);
        
        return (
          <div data-export-ignore="true" className="bg-slate-50 p-4 rounded-lg mt-4 border border-slate-200">
            <h3 className="text-sm font-bold text-slate-800 mb-3">📋 Report Summary</h3>
            
            {/* Header Summary */}
            <div className="mb-4 p-3 bg-white border border-slate-300 rounded">
              <p className="text-xs font-mono text-slate-700 whitespace-pre-wrap break-words">{summaries.headerSummary}</p>
              <button
                onClick={() => copyToClipboard(summaries.headerSummary)}
                className="mt-2 px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded transition"
              >
                📋 Copy Header
              </button>
            </div>

            {/* Regional Summary */}
            <div className="mb-4 p-3 bg-white border border-slate-300 rounded">
              <p className="text-xs font-mono text-slate-700 whitespace-pre-wrap break-words">{summaries.regionalSummary}</p>
              <button
                onClick={() => copyToClipboard(summaries.regionalSummary)}
                className="mt-2 px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded transition"
              >
                📋 Copy Regional
              </button>
            </div>

            {/* Branch Summary */}
            <div className="mb-4 p-3 bg-white border border-slate-300 rounded">
              <p className="text-xs font-mono text-slate-700 whitespace-pre-wrap break-words">{summaries.branchSummary}</p>
              <button
                onClick={() => copyToClipboard(summaries.branchSummary)}
                className="mt-2 px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded transition"
              >
                📋 Copy Branch
              </button>
            </div>

            {/* Full Summary */}
            <div className="p-3 bg-white border border-slate-300 rounded">
              <p className="text-xs font-mono text-slate-700 whitespace-pre-wrap break-words">{summaries.fullSummary}</p>
              <button
                onClick={() => copyToClipboard(summaries.fullSummary)}
                className="mt-2 px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition font-bold"
              >
                📋 Copy All
              </button>
            </div>

            {copyFeedback && (
              <div className="mt-2 text-xs text-center text-green-600 font-semibold">{copyFeedback}</div>
            )}
          </div>
        );
      })()}

      {/* MODAL POPUP */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-y-auto animate-slideUp">
            <div className="sticky top-0 flex justify-between items-center bg-gradient-to-r from-slate-800 to-slate-700 text-white p-4 rounded-t-xl">
              <h3 className="font-bold text-lg">{modalTitle}</h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-white font-bold text-xl hover:bg-red-600 px-3 py-1 rounded transition duration-200"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-x-auto">
              {/* MODAL DETAIL - Detail WONUM */}
              {modalType === 'detail' && (
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-700 text-white">
                      <th className="border border-slate-500 p-2 text-left font-bold">BRANCH</th>
                      <th className="border border-slate-500 p-2 text-left font-bold">STO</th>
                      <th className="border border-slate-500 p-2 text-left font-bold">WONUM</th>
                      <th className="border border-slate-500 p-2 text-left font-bold">KATEGORI MANJA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalData.length > 0 ? (
                      modalData.map((row: any, idx: number) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-slate-50 hover:bg-blue-50'} style={{ transition: 'background-color 0.2s ease' }}>
                          <td className="border border-slate-300 p-2 text-black">{row.BRANCH}</td>
                          <td className="border border-slate-300 p-2 text-black">{row.STO}</td>
                          <td className="border border-slate-300 p-2 font-mono text-black">{row.WONUM}</td>
                          <td className="border border-slate-300 p-2 text-black">{row.KATEGORI_MANJA}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="border border-slate-300 p-2 text-center text-slate-800 font-semibold">
                          Tidak ada data
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

              {/* MODAL SUMMARY - Summary dengan expand/collapse */}
              {modalType === 'summary' && (
                <table ref={summaryTableRef} className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-700 text-white">
                      <th className="border border-slate-500 p-2 text-left font-bold">REGIONAL / BRANCH</th>
                      <th className="border border-slate-500 p-2 text-center font-bold">MANJA EXP</th>
                      <th className="border border-slate-500 p-2 text-center font-bold">MANJA HI</th>
                      <th className="border border-slate-500 p-2 text-center font-bold">MANJA H+</th>
                      <th className="border border-slate-500 p-2 text-center font-bold">NON MANJA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalData.map((regional: any) => (
                      <React.Fragment key={regional.regional}>
                        {/* REGIONAL ROW */}
                        <tr className="bg-slate-100 hover:bg-slate-200">
                          <td className="border border-slate-400 p-2 font-bold text-black">
                            <span
                              onClick={() => toggleExpandRow(regional.regional)}
                              className="cursor-pointer select-none"
                            >
                              {expandedRows.has(regional.regional) ? '▼' : '▶'} {regional.regional}
                            </span>
                          </td>
                          <td className="border border-slate-400 p-2 text-center font-bold text-black">
                            {regional.manjaExp}
                          </td>
                          <td className="border border-slate-400 p-2 text-center font-bold text-black">
                            {regional.manjaHI}
                          </td>
                          <td className="border border-slate-400 p-2 text-center font-bold text-black">
                            {regional.manjaHPlus}
                          </td>
                          <td className="border border-slate-400 p-2 text-center font-bold text-black">
                            {regional.nonManja}
                          </td>
                        </tr>

                        {/* BRANCH ROWS - Show when expanded */}
                        {expandedRows.has(regional.regional) &&
                          regional.branches.map((branch: any) => (
                            <React.Fragment key={`${regional.regional}-${branch.branch}`}>
                              <tr className="bg-slate-50 hover:bg-blue-50">
                                <td className="border border-slate-300 p-2 pl-6 text-black">
                                  <span
                                    onClick={() => toggleExpandRow(`${regional.regional}-${branch.branch}`)}
                                    className="cursor-pointer select-none"
                                  >
                                    {expandedRows.has(`${regional.regional}-${branch.branch}`) ? '▼' : '▶'} {branch.branch}
                                  </span>
                                </td>
                                <td className="border border-slate-300 p-2 text-center text-black">
                                  {branch.manjaExp}
                                </td>
                                <td className="border border-slate-300 p-2 text-center text-black">
                                  {branch.manjaHI}
                                </td>
                                <td className="border border-slate-300 p-2 text-center text-black">
                                  {branch.manjaHPlus}
                                </td>
                                <td className="border border-slate-300 p-2 text-center text-black">
                                  {branch.nonManja}
                                </td>
                              </tr>

                              {/* SERVICE AREA (STO) ROWS - Show when branch expanded */}
                              {expandedRows.has(`${regional.regional}-${branch.branch}`) &&
                                branch.serviceAreas.map((sto: any) => (
                                  <tr key={`${regional.regional}-${branch.branch}-${sto.serviceArea}`} className="bg-white hover:bg-blue-50">
                                    <td className="border border-slate-300 p-2 pl-12 text-black">
                                      {sto.serviceArea}
                                    </td>
                                    <td className="border border-slate-300 p-2 text-center text-black">
                                      {sto.manjaExp}
                                    </td>
                                    <td className="border border-slate-300 p-2 text-center text-black">
                                      {sto.manjaHI}
                                    </td>
                                    <td className="border border-slate-300 p-2 text-center text-black">
                                      {sto.manjaHPlus}
                                    </td>
                                    <td className="border border-slate-300 p-2 text-center text-black">
                                      {sto.nonManja}
                                    </td>
                                  </tr>
                                ))}
                            </React.Fragment>
                          ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              )}

              {modalData.length === 0 && (
                <div className="text-center text-slate-800 font-semibold p-4">Tidak ada data</div>
              )}

              <div className="mt-4 text-sm text-slate-800 font-semibold">
                {modalType === 'detail' && `Total: ${modalData.length} records`}
              </div>
            </div>

            <div className="bg-slate-100 px-4 py-3 border-t flex justify-end gap-2 rounded-b-xl">
              {modalType === 'summary' && showExportButton && (
                <button
                  onClick={exportSummaryTable}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition duration-200 flex items-center gap-2"
                >
                  📥 Export PNG
                </button>
              )}
              <button
                onClick={() => setModalOpen(false)}
                className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded transition duration-200"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
      
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}