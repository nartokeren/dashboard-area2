'use client';

import React, { useState, useEffect } from 'react';
import { format, startOfMonth, isToday, isSameDay, isSameMonth, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import * as XLSX from 'xlsx';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

// ============================================
// 1. MAPPING REGIONAL
// ============================================
const regionalMapping: { [key: string]: string } = {
  'SERANG': 'BANTEN',
  'TANGERANG': 'BANTEN',
  'BEKASI': 'EASTERN JABOTABEK',
  'BOGOR': 'EASTERN JABOTABEK',
  'KARAWANG': 'EASTERN JABOTABEK',
  'NORTHERN JAKARTA': 'JAKARTA',
  'SOUTHERN JAKARTA': 'JAKARTA',
  'BANDUNG': 'JAWA BARAT',
  'CIREBON': 'JAWA BARAT',
  'SOREANG': 'JAWA BARAT',
  'TASIKMALAYA': 'JAWA BARAT',
};

// ============================================
// 2. TARGET PER BRANCH
// ============================================
const targetMapping: { [key: string]: number } = {
  'SERANG': 181,
  'TANGERANG': 179,
  'BEKASI': 197,
  'BOGOR': 201,
  'KARAWANG': 185,
  'NORTHERN JAKARTA': 239,
  'SOUTHERN JAKARTA': 365,
  'BANDUNG': 401,
  'CIREBON': 89,
  'SOREANG': 161,
  'TASIKMALAYA': 116,
};

// ============================================
// 3. KOMPONEN UTAMA
// ============================================
export default function TabelAOIndihome({
  data,
  filteredData,
  setData,
  setFilteredData,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  handleFileUpload,
  processData,
  exportToPNG,
}: any) {

  const safeFilteredData = filteredData || [];
  const [statusDateFrom, setStatusDateFrom] = useState('');
  const [statusDateTo, setStatusDateTo] = useState('');
  const currentHour = new Date().getHours();
  const today = new Date();

  useEffect(() => {
    const now = new Date();
    const firstDay = startOfMonth(now);
    setDateFrom(format(firstDay, 'yyyy-MM-dd'));
    setDateTo(format(now, 'yyyy-MM-dd'));
    setStatusDateFrom(format(firstDay, 'yyyy-MM-dd'));
    setStatusDateTo(format(now, 'yyyy-MM-dd'));
  }, []);

  const excelSerialToDate = (num: number): Date => {
    const wholeDays = Math.floor(num);
    const fractionalDay = num - wholeDays;
    const totalSeconds = Math.round(fractionalDay * 86400);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return new Date(1899, 11, 30 + wholeDays, hours, minutes, seconds);
  };

  const parseDate = (value: any): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d;
      const num = parseFloat(value);
      if (!isNaN(num)) return excelSerialToDate(num);
    }
    if (typeof value === 'number') return excelSerialToDate(value);
    return null;
  };

  const downloadData = (data: any[], label: string) => {
    if (data.length === 0) {
      alert(`⚠️ Tidak ada data untuk ${label}`);
      return;
    }
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    for (const row of data) {
      const values = headers.map(h => `"${row[h]}"`);
      csvRows.push(values.join(','));
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${label}_${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
  };

  const getDataForMetric = (type: string) => {
    switch(type) {
      case 'RE': return safeFilteredData;
      case 'PS': return safeFilteredData.filter((row: any) => row['STATUS'] === 'COMPWORK');
      case 'CANCEL': return safeFilteredData.filter((row: any) => row['STATUS'] === 'CANCLWORK');
      case 'KENDALA_TEKNIK': return safeFilteredData.filter((row: any) => row['STATUS'] === 'WORKFAIL' && (row['ERRORCODE_AKHIR'] === 'KENDALA TEKNIK' || row['ERRORCODE_AKHIR'] === 'KENDALA TEKNIS'));
      case 'KENDALA_PELANGGAN': return safeFilteredData.filter((row: any) => row['STATUS'] === 'WORKFAIL' && row['ERRORCODE_AKHIR'] === 'KENDALA PELANGGAN');
      case 'KENDALA_LAINNYA': return safeFilteredData.filter((row: any) => row['STATUS'] === 'WORKFAIL' && row['ERRORCODE_AKHIR'] === 'KENDALA LAINNYA');
      default: return [];
    }
  };

  // ============================================
  // 4. HITUNG METRIK (TABEL 1)
  // ============================================
  const calculateBranchData = () => {
    const fromDate = dateFrom ? startOfDay(new Date(dateFrom)) : null;
    const toDate = dateTo ? endOfDay(new Date(dateTo)) : null;

    const dateFiltered = safeFilteredData.filter((row: any) => {
      const dateCreated = parseDate(row['DATECREATED']);
      if (!dateCreated) return false;
      if (fromDate && isBefore(dateCreated, fromDate)) return false;
      if (toDate && isAfter(dateCreated, toDate)) return false;
      return true;
    });

    const statusFrom = statusDateFrom ? startOfDay(new Date(statusDateFrom)) : null;
    const statusTo = statusDateTo ? endOfDay(new Date(statusDateTo)) : null;

    const statusDateFiltered = safeFilteredData.filter((row: any) => {
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

      // PS HI & RE HI (HARI INI)
if (status === 'COMPWORK' && statusDate && isSameDay(statusDate, new Date())) bd.psHI++;
if (dateCreated && isSameDay(dateCreated, new Date())) bd.reHI++;

// PS MTD (FILTER STATUSDATE)
if (status === 'COMPWORK' && statusDate) {
  const statusFrom = statusDateFrom ? startOfDay(new Date(statusDateFrom)) : null;
  const statusTo = statusDateTo ? endOfDay(new Date(statusDateTo)) : null;
  let match = true;
  if (statusFrom && isBefore(statusDate, statusFrom)) match = false;
  if (statusTo && isAfter(statusDate, statusTo)) match = false;
  if (match) bd.psMTD++;
}

// RE MTD (FILTER DATECREATED)
if (dateCreated) {
  const fromDate = dateFrom ? startOfDay(new Date(dateFrom)) : null;
  const toDate = dateTo ? endOfDay(new Date(dateTo)) : null;
  let match = true;
  if (fromDate && isBefore(dateCreated, fromDate)) match = false;
  if (toDate && isAfter(dateCreated, toDate)) match = false;
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

  // ============================================
  // 5. HITUNG DATA UNTUK TABEL PER-JAM (HARI INI)
  // ============================================
  const calculateJamData = (branchData: any[], isRE: boolean) => {
    const jamRange = [8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23];
    
    const perJam: { [key: string]: number } = {};
    jamRange.forEach(j => { perJam[j] = 0; });

    branchData.forEach((row: any) => {
      const dateField = isRE ? parseDate(row['DATECREATED']) : parseDate(row['STATUSDATE']);
      if (!dateField) return;
      const hour = dateField.getHours();
      
      for (let j = 8; j <= 23; j++) {
        if (hour <= j) {
          perJam[j] = (perJam[j] || 0) + 1;
          break;
        }
      }
    });

    const jamCounts: { [key: string]: number } = {};
    let cumulative = 0;
    jamRange.forEach(j => {
      cumulative += perJam[j] || 0;
      jamCounts[j] = cumulative;
    });

    return jamCounts;
  };

  // --- RE: Semua status, DATECREATED hari ini ---
  const reData = safeFilteredData.filter((row: any) => {
    const dateCreated = parseDate(row['DATECREATED']);
    if (!dateCreated) return false;
    return isSameDay(dateCreated, today);
  });

  // --- PS: Hanya COMPWORK, STATUSDATE hari ini ---
  const psData = safeFilteredData.filter((row: any) => {
    const statusDate = parseDate(row['STATUSDATE']);
    if (!statusDate) return false;
    if (row['STATUS'] !== 'COMPWORK') return false;
    return isSameDay(statusDate, today);
  });

  const branchGroups = new Map<string, any[]>();
  reData.forEach((row: any) => {
    const branch = row['DISTRICT_TIF'] || 'UNKNOWN';
    if (!branchGroups.has(branch)) branchGroups.set(branch, []);
    branchGroups.get(branch)!.push(row);
  });

  const jamResult: any[] = [];
  branchGroups.forEach((reRows, branch) => {
    const psRows = psData.filter((row: any) => (row['DISTRICT_TIF'] || 'UNKNOWN') === branch);
    const reJam = calculateJamData(reRows, true);
    const psJam = calculateJamData(psRows, false);
    
    jamResult.push({
      branch,
      regional: regionalMapping[branch] || 'LAINNYA',
      reJam,
      psJam,
    });
  });

  const regionalOrder = ['BANTEN', 'EASTERN JABOTABEK', 'JAKARTA', 'JAWA BARAT'];
  jamResult.sort((a, b) => {
    const regA = regionalOrder.indexOf(a.regional);
    const regB = regionalOrder.indexOf(b.regional);
    if (regA !== regB) return regA - regB;
    return a.branch.localeCompare(b.branch);
  });

  const finalJamData: any[] = [];
  const regionalMapJam = new Map<string, any[]>();
  jamResult.forEach(item => {
    const reg = item.regional || 'LAINNYA';
    if (!regionalMapJam.has(reg)) regionalMapJam.set(reg, []);
    regionalMapJam.get(reg)!.push(item);
  });

  let grandTotalRE: any = {};
  let grandTotalPS: any = {};
  const jamRange = [8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23];
  jamRange.forEach(j => {
    grandTotalRE[j] = 0;
    grandTotalPS[j] = 0;
  });

  regionalOrder.forEach(reg => {
    const items = regionalMapJam.get(reg) || [];
    if (items.length === 0) return;

    const subTotalRE: any = {};
    const subTotalPS: any = {};
    jamRange.forEach(j => {
      subTotalRE[j] = 0;
      subTotalPS[j] = 0;
    });

    items.forEach(item => {
      jamRange.forEach(j => {
        subTotalRE[j] += item.reJam[j] || 0;
        subTotalPS[j] += item.psJam[j] || 0;
        grandTotalRE[j] += item.reJam[j] || 0;
        grandTotalPS[j] += item.psJam[j] || 0;
      });
      finalJamData.push({ ...item, isSubTotal: false });
    });

    finalJamData.push({
      branch: 'SUB TOTAL',
      regional: reg,
      isSubTotal: true,
      reJam: subTotalRE,
      psJam: subTotalPS,
    });
  });

  finalJamData.push({
    branch: 'AREA 2',
    regional: 'GRAND TOTAL',
    isArea2: true,
    reJam: grandTotalRE,
    psJam: grandTotalPS,
  });

  // ============================================
  // 6. HITUNG DATA KENDALA (HANYA H-1)
  // ============================================
  const calculateKendalaData = (data: any[]) => {
    const allowedStatus = ['CANCLWORK', 'STARTWORK', 'WORKFAIL'];
    const filteredData = data.filter((row: any) => allowedStatus.includes(row['STATUS']));
    
    const districts = Array.from(new Set(filteredData.map((row: any) => row['DISTRICT_TIF']))).filter(Boolean);
    
    const kendalaMap = new Map<string, Map<string, Map<string, number>>>();
    
    filteredData.forEach((row: any) => {
      const district = row['DISTRICT_TIF'] || 'UNKNOWN';
      const status = row['STATUS'] || '';
      const errorCode = row['ERRORCODE_AKHIR'] || '';
      const subErrorCode = row['SUBERRORCODE_AKHIR'] || '';
      
      let category = errorCode;
      if (!category && status === 'STARTWORK') category = 'SISA PI H-1';
      if (!category && status === 'CANCLWORK') category = 'ORDER CANCEL H-1';
      if (!category) category = 'LAINNYA';
      
      let detail = subErrorCode;
      if (!detail && status === 'STARTWORK') detail = 'STARTWORK';
      if (!detail && status === 'CANCLWORK') detail = 'CANCELWORK';
      if (!detail) detail = 'KOSONG';
      
      if (!kendalaMap.has(category)) {
        kendalaMap.set(category, new Map());
      }
      const categoryMap = kendalaMap.get(category)!;
      if (!categoryMap.has(detail)) {
        categoryMap.set(detail, new Map());
      }
      const detailMap = categoryMap.get(detail)!;
      detailMap.set(district, (detailMap.get(district) || 0) + 1);
    });
    
    const categoryGrandTotal = new Map<string, number>();
    kendalaMap.forEach((categoryMap, category) => {
      let total = 0;
      categoryMap.forEach((detailMap) => {
        detailMap.forEach((count) => {
          total += count;
        });
      });
      categoryGrandTotal.set(category, total);
    });
    
    const sortedCategories = Array.from(kendalaMap.keys()).sort((a, b) => {
      if (a === 'ORDER CANCEL H-1') return -1;
      if (b === 'ORDER CANCEL H-1') return 1;
      return (categoryGrandTotal.get(b) || 0) - (categoryGrandTotal.get(a) || 0);
    });
    
    const result: any[] = [];
    const grandTotalPerDistrict: { [key: string]: number } = {};
    
    sortedCategories.forEach((category) => {
      const categoryMap = kendalaMap.get(category)!;
      
      const sortedDetails = Array.from(categoryMap.keys()).sort((a, b) => {
        const totalA = Array.from(categoryMap.get(a)!.values()).reduce((sum, val) => sum + val, 0);
        const totalB = Array.from(categoryMap.get(b)!.values()).reduce((sum, val) => sum + val, 0);
        return totalB - totalA;
      });
      
      sortedDetails.forEach((detail) => {
        const detailMap = categoryMap.get(detail)!;
        const row: any = {
          category,
          detail,
          districtData: {},
          grandTotal: 0,
        };
        
        detailMap.forEach((count, district) => {
          row.districtData[district] = count;
          row.grandTotal += count;
          grandTotalPerDistrict[district] = (grandTotalPerDistrict[district] || 0) + count;
        });
        
        result.push(row);
      });
    });
    
    const grandTotalOverall = Object.values(grandTotalPerDistrict).reduce((a, b) => a + b, 0);
    result.forEach(row => {
      row.percentage = grandTotalOverall > 0 ? (row.grandTotal / grandTotalOverall) * 100 : 0;
    });
    
    return {
      rows: result,
      districts,
      grandTotalOverall,
      grandTotalPerDistrict,
    };
  };

  // ============================================
  // 7. DATA H-1 DAN KENDALA
  // ============================================
  const dateToObj = dateTo ? new Date(dateTo) : new Date();
  const hMinus1 = new Date(dateToObj);
  hMinus1.setDate(hMinus1.getDate() - 1);

  const hMinus1Data = safeFilteredData.filter((row: any) => {
    const dateCreated = parseDate(row['DATECREATED']);
    if (!dateCreated) return false;
    return isSameDay(dateCreated, hMinus1);
  });

  const kendalaData = calculateKendalaData(hMinus1Data);
  const { rows: kendalaRows, districts, grandTotalOverall, grandTotalPerDistrict } = kendalaData;

  // ============================================
  // 8. RENDER
  // ============================================
    // ============================================
  // 6. EXECUTIVE SUMMARY (TABEL + GRAFIK COMBO)
  // ============================================
  const calculateExecutiveSummary = () => {
    const fromDate = dateFrom ? startOfDay(new Date(dateFrom)) : null;
    const toDate = dateTo ? endOfDay(new Date(dateTo)) : null;

    const reSummaryData = safeFilteredData.filter((row: any) => {
      const dateCreated = parseDate(row['DATECREATED']);
      if (!dateCreated) return false;
      if (fromDate && isBefore(dateCreated, fromDate)) return false;
      if (toDate && isAfter(dateCreated, toDate)) return false;
      return true;
    });

    const statusFrom = statusDateFrom ? startOfDay(new Date(statusDateFrom)) : null;
    const statusTo = statusDateTo ? endOfDay(new Date(statusDateTo)) : null;

    const psSummaryData = safeFilteredData.filter((row: any) => {
      const statusDate = parseDate(row['STATUSDATE']);
      if (!statusDate) return false;
      if (row['STATUS'] !== 'COMPWORK') return false;
      if (statusFrom && isBefore(statusDate, statusFrom)) return false;
      if (statusTo && isAfter(statusDate, statusTo)) return false;
      return true;
    });

    const daysInFilter = dateFrom && dateTo 
      ? Math.ceil((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (1000 * 60 * 60 * 24)) + 1
      : 1;

    // Regional
    const regionalOrder = ['EASTERN JABOTABEK', 'JAWA BARAT', 'JAKARTA', 'BANTEN'];
    const regionalData: any[] = [];

    regionalOrder.forEach((region) => {
      const reCount = reSummaryData.filter((row: any) => regionalMapping[row['DISTRICT_TIF']] === region).length;
      const psCount = psSummaryData.filter((row: any) => regionalMapping[row['DISTRICT_TIF']] === region).length;
      const psRePercent = reCount > 0 ? (psCount / reCount) * 100 : 0;
      
      regionalData.push({
        region,
        reMTD: reCount,
        psMTD: psCount,
        psRePercent,
        avgRE: Math.round(reCount / daysInFilter),
        avgPS: Math.round(psCount / daysInFilter),
      });
    });

    regionalData.sort((a, b) => b.psRePercent - a.psRePercent);

    const grandTotalRE = regionalData.reduce((sum, item) => sum + item.reMTD, 0);
    const grandTotalPS = regionalData.reduce((sum, item) => sum + item.psMTD, 0);
    const grandTotalPsRe = grandTotalRE > 0 ? (grandTotalPS / grandTotalRE) * 100 : 0;
    const grandTotalAvgRE = Math.round(grandTotalRE / daysInFilter);
    const grandTotalAvgPS = Math.round(grandTotalPS / daysInFilter);

    // Daily Data untuk Grafik Combo
    const dailyMap = new Map<string, { re: number, ps: number }>();

    reSummaryData.forEach((row: any) => {
      const dateCreated = parseDate(row['DATECREATED']);
      if (!dateCreated) return;
      const dateKey = format(dateCreated, 'yyyy-MM-dd');
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { re: 0, ps: 0 });
      }
      dailyMap.get(dateKey)!.re++;
    });

    psSummaryData.forEach((row: any) => {
      const statusDate = parseDate(row['STATUSDATE']);
      if (!statusDate) return;
      const dateKey = format(statusDate, 'yyyy-MM-dd');
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { re: 0, ps: 0 });
      }
      dailyMap.get(dateKey)!.ps++;
    });

    const sortedDates = Array.from(dailyMap.keys()).sort();
    const dailyData = sortedDates.map(dateKey => {
      const data = dailyMap.get(dateKey)!;
      const psRePercent = data.re > 0 ? (data.ps / data.re) * 100 : 0;
      return {
        date: new Date(dateKey),
        re: data.re,
        ps: data.ps,
        psRePercent,
      };
    });

    // Branch
    const branchSummaryMap = new Map<string, { reCount: number, psCount: number }>();

    reSummaryData.forEach((row: any) => {
      const branch = row['DISTRICT_TIF'] || 'UNKNOWN';
      if (!branchSummaryMap.has(branch)) {
        branchSummaryMap.set(branch, { reCount: 0, psCount: 0 });
      }
      branchSummaryMap.get(branch)!.reCount++;
    });

    psSummaryData.forEach((row: any) => {
      const branch = row['DISTRICT_TIF'] || 'UNKNOWN';
      if (!branchSummaryMap.has(branch)) {
        branchSummaryMap.set(branch, { reCount: 0, psCount: 0 });
      }
      branchSummaryMap.get(branch)!.psCount++;
    });

    const branchData: any[] = [];
    branchSummaryMap.forEach((value, branch) => {
      const psRePercent = value.reCount > 0 ? (value.psCount / value.reCount) * 100 : 0;
      branchData.push({
        branch,
        reMTD: value.reCount,
        psMTD: value.psCount,
        psRePercent,
        avgRE: Math.round(value.reCount / daysInFilter),
        avgPS: Math.round(value.psCount / daysInFilter),
      });
    });

    branchData.sort((a, b) => b.psRePercent - a.psRePercent);

    const branchGrandTotalRE = branchData.reduce((sum, item) => sum + item.reMTD, 0);
    const branchGrandTotalPS = branchData.reduce((sum, item) => sum + item.psMTD, 0);
    const branchGrandTotalPsRe = branchGrandTotalRE > 0 ? (branchGrandTotalPS / branchGrandTotalRE) * 100 : 0;
    const branchGrandTotalAvgRE = Math.round(branchGrandTotalRE / daysInFilter);
    const branchGrandTotalAvgPS = Math.round(branchGrandTotalPS / daysInFilter);

    return {
      regionalData,
      branchData,
      dailyData,
      grandTotalRE,
      grandTotalPS,
      grandTotalPsRe,
      grandTotalAvgRE,
      grandTotalAvgPS,
      branchGrandTotalRE,
      branchGrandTotalPS,
      branchGrandTotalPsRe,
      branchGrandTotalAvgRE,
      branchGrandTotalAvgPS,
      daysInFilter,
    };
  };

  const summary = calculateExecutiveSummary();
  return (
    <div>
      {/* FILTER */}
      <div className="bg-white p-3 rounded-lg shadow-md mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">📅 DATECREATED</label>
            <div className="flex gap-1">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border rounded px-2 py-1 w-full text-xs" />
              <span className="text-slate-400 text-xs self-center">—</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border rounded px-2 py-1 w-full text-xs" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">📅 STATUSDATE</label>
            <div className="flex gap-1">
              <input type="date" value={statusDateFrom} onChange={(e) => setStatusDateFrom(e.target.value)} className="border rounded px-2 py-1 w-full text-xs" />
              <span className="text-slate-400 text-xs self-center">—</span>
              <input type="date" value={statusDateTo} onChange={(e) => setStatusDateTo(e.target.value)} className="border rounded px-2 py-1 w-full text-xs" />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="block text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200" />
          <button onClick={processData} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-1 px-4 rounded-lg">🔍 Proses Data</button>
          <button onClick={exportToPNG} className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-1 px-4 rounded-lg">🖼️ Export PNG</button>
        </div>
        <p className="text-xs text-blue-600 font-semibold mt-1">📊 {safeFilteredData.length} baris data ditampilkan</p>
      </div>

      {/* KARTU */}
      {safeFilteredData.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
          {[
            { key: 'RE', label: 'TOTAL RE', val: result.totalRE, sub: 'Semua order', color: 'blue', bg: 'blue-100', text: 'blue-700' },
            { key: 'PS', label: 'TOTAL PS', val: result.totalPS, sub: 'COMPWORK', color: 'green', bg: 'green-100', text: 'green-700' },
            { key: 'CANCEL', label: 'CANCEL', val: result.totalCANCEL, sub: 'CANCLWORK', color: 'red', bg: 'red-100', text: 'red-700' },
            { key: 'KENDALA_TEKNIK', label: 'KENDALA TEKNIK', val: result.totalKendalaTeknik, sub: 'WORKFAIL', color: 'amber', bg: 'amber-100', text: 'amber-700' },
            { key: 'KENDALA_PELANGGAN', label: 'KENDALA PELANGGAN', val: result.totalKendalaPelanggan, sub: 'WORKFAIL', color: 'violet', bg: 'violet-100', text: 'violet-700' },
            { key: 'KENDALA_LAINNYA', label: 'KENDALA LAINNYA', val: result.totalKendalaLainnya, sub: 'WORKFAIL', color: 'slate', bg: 'slate-100', text: 'slate-700' },
          ].map((item) => (
            <div key={item.key} className={`bg-white p-2 rounded-lg shadow-md border-l-4 border-${item.color}-500 relative`}>
              <p className="text-[10px] text-slate-500 font-semibold">{item.label}</p>
              <p className={`text-lg font-bold text-${item.color}-600`}>{item.val.toLocaleString()}</p>
              <p className="text-[8px] text-slate-400">{item.sub}</p>
              <button onClick={() => { const d = getDataForMetric(item.key); downloadData(d, item.key); }} className={`absolute top-1 right-1 text-[10px] bg-${item.bg} hover:bg-${item.color}-200 text-${item.text} px-1.5 py-0.5 rounded`}>📥</button>
            </div>
          ))}
          <div className={`bg-white p-2 rounded-lg shadow-md border-l-4 ${result.psRePercent >= 85 ? 'border-green-500' : 'border-yellow-500'}`}>
            <p className="text-[10px] text-slate-500 font-semibold">% PS/RE</p>
            <p className={`text-lg font-bold ${result.psRePercent >= 85 ? 'text-green-600' : 'text-yellow-600'}`}>{result.psRePercent.toFixed(2)}%</p>
            <p className="text-[8px] text-slate-400">Target 85%</p>
          </div>
        </div>
      )}
            {/* ========================================== */}
      {/* EXECUTIVE SUMMARY (GRAFIK DI ATAS, TABEL DI BAWAH) */}
      {/* ========================================== */}
      {safeFilteredData.length > 0 && summary.branchData.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow-md mb-6">
          <h2 className="text-base font-bold text-slate-800 mb-3">📊 Executive Summary</h2>
          
          {/* GRAFIK COMBO - PAKAI Bar + Line TERPISAH */}
<div className="mb-4">
  <h3 className="text-xs font-semibold text-slate-600 mb-2 text-center">📈 Trend Harian RE, PS, & PS/RE</h3>
  <div className="h-64">
    <Bar
      data={{
        labels: summary.dailyData.map((item: any) => format(item.date, 'dd/MM')),
        datasets: [
          {
            label: 'RE',
            data: summary.dailyData.map((item: any) => item.re),
            backgroundColor: 'rgba(59, 130, 246, 0.7)',
            borderColor: 'rgb(59, 130, 246)',
            borderWidth: 1,
            yAxisID: 'y',
          },
          {
            label: 'PS',
            data: summary.dailyData.map((item: any) => item.ps),
            backgroundColor: 'rgba(34, 197, 94, 0.7)',
            borderColor: 'rgb(34, 197, 94)',
            borderWidth: 1,
            yAxisID: 'y',
          },
          // PS/RE pake Line terpisah, tapi kita kasih di dataset yang sama dengan type 'line' (hanya kalo pake Chart.js 4+)
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              boxWidth: 10,
              padding: 4,
              font: { size: 8 },
            },
          },
        },
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: { font: { size: 8 } },
          },
        },
      }}
    />
  </div>
</div>

          {/* TABEL REGIONAL */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">📋 Tabel Regional</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="border border-slate-600 p-1 text-left font-bold">Region</th>
                    <th className="border border-slate-600 p-1 text-right font-bold">RE MTD</th>
                    <th className="border border-slate-600 p-1 text-right font-bold">PS MTD</th>
                    <th className="border border-slate-600 p-1 text-right font-bold">PS/RE</th>
                    <th className="border border-slate-600 p-1 text-right font-bold">AVG RE</th>
                    <th className="border border-slate-600 p-1 text-right font-bold">AVG PS</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.regionalData.map((item: any, idx: number) => {
                    const rowColor = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50';
                    const isOnTarget = item.psRePercent >= 85;
                    return (
                      <tr key={idx} className={`${rowColor} hover:bg-blue-50 transition-colors`}>
                        <td className="border border-slate-300 p-1 font-bold text-blue-700">{item.region}</td>
                        <td className="border border-slate-300 p-1 text-right font-mono font-semibold text-blue-600">{item.reMTD.toLocaleString()}</td>
                        <td className="border border-slate-300 p-1 text-right font-mono font-semibold text-green-600">{item.psMTD.toLocaleString()}</td>
                        <td className={`border border-slate-300 p-1 text-right font-mono font-bold ${isOnTarget ? 'text-green-600' : 'text-red-600'}`}>
                          {item.psRePercent.toFixed(2)}%
                        </td>
                        <td className="border border-slate-300 p-1 text-right font-mono font-semibold text-blue-600">{item.avgRE.toLocaleString()}</td>
                        <td className="border border-slate-300 p-1 text-right font-mono font-semibold text-green-600">{item.avgPS.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-200 font-bold">
                    <td className="border border-slate-300 p-1 text-blue-800">Grand Total</td>
                    <td className="border border-slate-300 p-1 text-right font-mono text-blue-700">{summary.grandTotalRE.toLocaleString()}</td>
                    <td className="border border-slate-300 p-1 text-right font-mono text-green-700">{summary.grandTotalPS.toLocaleString()}</td>
                    <td className={`border border-slate-300 p-1 text-right font-mono ${summary.grandTotalPsRe >= 85 ? 'text-green-700' : 'text-red-700'}`}>
                      {summary.grandTotalPsRe.toFixed(2)}%
                    </td>
                    <td className="border border-slate-300 p-1 text-right font-mono text-blue-700">{summary.grandTotalAvgRE.toLocaleString()}</td>
                    <td className="border border-slate-300 p-1 text-right font-mono text-green-700">{summary.grandTotalAvgPS.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* TABEL BRANCH */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2">📋 Tabel Branch</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-700 text-white">
                    <th className="border border-slate-600 p-1 text-center font-bold">No</th>
                    <th className="border border-slate-600 p-1 text-left font-bold">BRANCH</th>
                    <th className="border border-slate-600 p-1 text-right font-bold">RE MTD</th>
                    <th className="border border-slate-600 p-1 text-right font-bold">PS MTD</th>
                    <th className="border border-slate-600 p-1 text-right font-bold">PS/RE</th>
                    <th className="border border-slate-600 p-1 text-left font-bold">AVG RE</th>
                    <th className="border border-slate-600 p-1 text-left font-bold">AVG PS</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.branchData.map((item: any, idx: number) => {
                    const rowColor = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50';
                    const isOnTarget = item.psRePercent >= 85;
                    
                    const avgREPercent = summary.branchGrandTotalAvgRE > 0 
                      ? (item.avgRE / summary.branchGrandTotalAvgRE) * 100 
                      : 0;
                    const avgPSPercent = summary.branchGrandTotalAvgPS > 0 
                      ? (item.avgPS / summary.branchGrandTotalAvgPS) * 100 
                      : 0;
                    
                    return (
                      <tr key={idx} className={`${rowColor} hover:bg-blue-50 transition-colors`}>
                        <td className="border border-slate-300 p-1 text-center text-slate-500">{idx + 1}</td>
                        <td className="border border-slate-300 p-1 font-bold text-blue-700">{item.branch}</td>
                        <td className="border border-slate-300 p-1 text-right font-mono font-semibold text-blue-600">{item.reMTD.toLocaleString()}</td>
                        <td className="border border-slate-300 p-1 text-right font-mono font-semibold text-green-600">{item.psMTD.toLocaleString()}</td>
                        <td className={`border border-slate-300 p-1 text-right font-mono font-bold ${isOnTarget ? 'text-green-600' : 'text-red-600'}`}>
                          {item.psRePercent.toFixed(2)}%
                        </td>
                        
                        {/* AVG RE - progress bar */}
                        <td className="border border-slate-300 p-1">
                          <div className="flex items-center gap-1 min-w-[80px]">
                            <div className="flex-1 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(avgREPercent, 100)}%` }}
                              ></div>
                            </div>
                            <span className="text-[10px] font-mono font-semibold text-blue-600 w-10 text-right">
                              {item.avgRE}
                            </span>
                          </div>
                        </td>
                        
                        {/* AVG PS - progress bar */}
                        <td className="border border-slate-300 p-1">
                          <div className="flex items-center gap-1 min-w-[80px]">
                            <div className="flex-1 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-green-500 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(avgPSPercent, 100)}%` }}
                              ></div>
                            </div>
                            <span className="text-[10px] font-mono font-semibold text-green-600 w-10 text-right">
                              {item.avgPS}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  
                  <tr className="bg-slate-200 font-bold">
                    <td className="border border-slate-300 p-1 text-center"></td>
                    <td className="border border-slate-300 p-1 text-blue-800">Grand Total</td>
                    <td className="border border-slate-300 p-1 text-right font-mono text-blue-700">{summary.branchGrandTotalRE.toLocaleString()}</td>
                    <td className="border border-slate-300 p-1 text-right font-mono text-green-700">{summary.branchGrandTotalPS.toLocaleString()}</td>
                    <td className={`border border-slate-300 p-1 text-right font-mono ${summary.branchGrandTotalPsRe >= 85 ? 'text-green-700' : 'text-red-700'}`}>
                      {summary.branchGrandTotalPsRe.toFixed(2)}%
                    </td>
                    <td className="border border-slate-300 p-1 text-right font-mono text-blue-700">{summary.branchGrandTotalAvgRE.toLocaleString()}</td>
                    <td className="border border-slate-300 p-1 text-right font-mono text-green-700">{summary.branchGrandTotalAvgPS.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TABEL 1: FULFILLMENT ENDSTATE */}
      {/* ========================================== */}
      {safeFilteredData.length > 0 && result.branchArray.length > 0 && (
        <div className="bg-white p-3 rounded-lg shadow-md overflow-x-auto mb-6" id="table-container">
          <h2 className="text-sm font-bold text-slate-800 mb-2">📋 (New Sales) Fulfillment Endstate AREA 2</h2>
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
                      <td className={`border border-slate-300 p-1 text-center font-bold font-mono ${isArea2 ? 'text-white' : 'text-blue-600'}`}>{item.totalOrderPI}</td>

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
        </div>
      )}

      {/* ========================================== */}
      {/* TABEL 2: MONITORING PERGERAKAN ORDER PER-JAM (HARI INI) */}
      {/* ========================================== */}
      {safeFilteredData.length > 0 && finalJamData.length > 0 && (
        <div className="bg-white p-3 rounded-lg shadow-md overflow-x-auto" id="table-jam-container">
          <h2 className="text-sm font-bold text-slate-800 mb-2">
            📋 Monitoring Pergerakan Order New Sales Indihome per-Jam (Hari Ini)
          </h2>
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th rowSpan={2} className="border border-slate-600 p-1 text-left font-bold align-middle">REGIONAL</th>
                <th rowSpan={2} className="border border-slate-600 p-1 text-left font-bold align-middle">BRANCH</th>
                {[8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23].map((jam) => (
                  <th key={jam} colSpan={2} className="border border-slate-600 p-1 text-center font-bold bg-slate-700">
                    {String(jam).padStart(2, '0')}:00
                  </th>
                ))}
                <th rowSpan={2} className="border border-slate-600 p-1 text-center font-bold bg-slate-700">PS/RE</th>
              </tr>
              <tr className="bg-slate-600 text-white">
                {[8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23].map((jam) => (
                  <React.Fragment key={`header-${jam}`}>
                    <th key={`${jam}-re`} className="border border-slate-500 p-0.5 text-center font-semibold">RE</th>
                    <th key={`${jam}-ps`} className="border border-slate-500 p-0.5 text-center font-semibold">PS</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {(() => {
                const jamRowsWithSpan: any[] = [];
                let lastJamRegional = '';
                let jamRegionalCount = 0;

                finalJamData.forEach((item: any, idx: number) => {
                  const isSubTotal = item.isSubTotal === true;
                  const isArea2 = item.isArea2 === true;

                  if (!isArea2) {
                    if (item.regional !== lastJamRegional) {
                      jamRegionalCount = 1;
                      lastJamRegional = item.regional;
                      for (let i = idx + 1; i < finalJamData.length; i++) {
                        const next = finalJamData[i];
                        if (next.isArea2) break;
                        if (next.regional === item.regional) jamRegionalCount++;
                        else break;
                      }
                    }
                  }

                  jamRowsWithSpan.push({
                    ...item,
                    idx,
                    isSubTotal,
                    isArea2,
                    regionalCount: isArea2 ? 1 : (item.regional === lastJamRegional ? jamRegionalCount : 1),
                    isFirstInRegional: !isArea2 && item.regional === lastJamRegional && (idx === 0 || finalJamData[idx - 1]?.regional !== item.regional),
                  });
                });

                return jamRowsWithSpan.map((item: any) => {
                  const rowColor = item.idx % 2 === 0 ? 'bg-white' : 'bg-slate-50';
                  const isSubTotal = item.isSubTotal === true;
                  const isArea2 = item.isArea2 === true;
                  let bgColor = rowColor;
                  if (isSubTotal) bgColor = 'bg-blue-100';
                  if (isArea2) bgColor = 'bg-slate-800 text-white';

                  const totalRE = item.reJam?.[23] ?? 0;
                  const totalPS = item.psJam?.[23] ?? 0;
                  const psRePercent = totalRE > 0 ? (totalPS / totalRE) * 100 : 0;

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
                      {[8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23].map((jam) => {
                        const reValue = jam <= currentHour ? (item.reJam?.[jam] ?? 0) : '';
                        const psValue = jam <= currentHour ? (item.psJam?.[jam] ?? 0) : '';
                        return (
                          <React.Fragment key={`${item.idx}-${jam}`}>
                            <td key={`${item.idx}-${jam}-re`} className={`border border-slate-300 p-1 text-center font-mono ${isArea2 ? 'text-white' : 'text-blue-600 font-semibold'}`}>
                              {reValue}
                            </td>
                            <td key={`${item.idx}-${jam}-ps`} className={`border border-slate-300 p-1 text-center font-mono ${isArea2 ? 'text-white' : 'text-green-600 font-semibold'}`}>
                              {psValue}
                            </td>
                          </React.Fragment>
                        );
                      })}
                      <td className={`border border-slate-300 p-1 text-center font-mono font-bold ${isArea2 ? 'text-white' : (psRePercent >= 85 ? 'text-green-600' : 'text-red-600')}`}>
                        {currentHour < 8 ? '-' : psRePercent.toFixed(2) + '%'}
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================================== */}
      {/* TABEL 3: SISA ORDER TIDAK PS H-1 */}
      {/* ========================================== */}
      {safeFilteredData.length > 0 && kendalaRows.length > 0 && (
        <div className="bg-white p-3 rounded-lg shadow-md overflow-x-auto mt-6">
          <h2 className="text-sm font-bold text-slate-800 mb-2">
            📋 SISA ORDER TIDAK PS H-1
          </h2>
          <p className="text-xs text-slate-500 mb-2">
            Data berdasarkan DATECREATED: {format(hMinus1, 'dd MMMM yyyy')}
          </p>
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="border border-slate-600 p-1 text-left font-bold align-middle">KATEGORI KENDALA</th>
                <th className="border border-slate-600 p-1 text-left font-bold align-middle">DETAIL KENDALA</th>
                {districts.map((d: string) => (
                  <th key={d} className="border border-slate-600 p-1 text-center font-bold">{d}</th>
                ))}
                <th className="border border-slate-600 p-1 text-center font-bold">Grand Total</th>
                <th className="border border-slate-600 p-1 text-center font-bold">%</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const rowsWithSpan: any[] = [];
                let lastCategory = '';
                let categoryCount = 0;

                kendalaRows.forEach((row: any, idx: number) => {
                  if (row.category !== lastCategory) {
                    categoryCount = 1;
                    lastCategory = row.category;
                    for (let i = idx + 1; i < kendalaRows.length; i++) {
                      const next = kendalaRows[i];
                      if (next.category === row.category) categoryCount++;
                      else break;
                    }
                  }

                  rowsWithSpan.push({
                    ...row,
                    idx,
                    categoryCount,
                    isFirstInCategory: row.category === lastCategory && (idx === 0 || kendalaRows[idx - 1]?.category !== row.category),
                  });
                });

                let grandTotalAll = 0;
                kendalaRows.forEach(row => { grandTotalAll += row.grandTotal; });

                return (
                  <>
                    {rowsWithSpan.map((row: any) => {
                      const rowColor = row.idx % 2 === 0 ? 'bg-white' : 'bg-slate-50';
                      
                      let categoryColor = 'text-slate-600';
                      if (row.category === 'SISA PI H-1') categoryColor = 'text-amber-600 font-bold';
                      else if (row.category === 'ORDER CANCEL H-1') categoryColor = 'text-red-600 font-bold';
                      else if (row.category === 'KENDALA PELANGGAN') categoryColor = 'text-violet-600';
                      else if (row.category === 'KENDALA TEKNIK') categoryColor = 'text-cyan-600';
                      
                      let percentColor = 'text-green-600';
                      if (row.percentage > 10) percentColor = 'text-red-600 font-bold';
                      else if (row.percentage > 5) percentColor = 'text-yellow-600 font-bold';

                      return (
                        <tr key={row.idx} className={`${rowColor} hover:bg-blue-50 transition-colors`}>
                          {row.isFirstInCategory ? (
                            <td rowSpan={row.categoryCount} className={`border border-slate-300 p-1 font-semibold align-middle ${categoryColor}`}>
                              {row.category}
                            </td>
                          ) : null}
                          <td className="border border-slate-300 p-1 text-slate-700">{row.detail}</td>
                          {districts.map((d: string) => (
                            <td key={d} className="border border-slate-300 p-1 text-center text-slate-600">
                              {row.districtData[d] || 0}
                            </td>
                          ))}
                          <td className="border border-slate-300 p-1 text-center font-bold text-blue-600">{row.grandTotal}</td>
                          <td className={`border border-slate-300 p-1 text-center font-bold ${percentColor}`}>
                            {row.percentage.toFixed(2)}%
                          </td>
                        </tr>
                      );
                    })}
                    
                    <tr className="bg-slate-200 font-bold hover:bg-slate-300 transition-colors">
                      <td colSpan={2} className="border border-slate-300 p-1 text-center text-slate-800">
                        GRAND TOTAL
                      </td>
                      {districts.map((d: string) => {
                        let districtTotal = 0;
                        kendalaRows.forEach(row => {
                          districtTotal += row.districtData[d] || 0;
                        });
                        return (
                          <td key={d} className="border border-slate-300 p-1 text-center text-slate-800">
                            {districtTotal}
                          </td>
                        );
                      })}
                      <td className="border border-slate-300 p-1 text-center text-blue-700">{grandTotalAll}</td>
                      <td className="border border-slate-300 p-1 text-center text-slate-800">100%</td>
                    </tr>
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>
      )}

      {safeFilteredData.length === 0 && (
        <div className="bg-white p-6 rounded-lg shadow-md text-center">
          <p className="text-slate-500 text-sm">🚀 Upload file Excel dan klik <strong>"Proses Data"</strong> untuk mulai!</p>
          <p className="text-slate-400 text-xs mt-1">Pastikan file Excel memiliki kolom: DATECREATED, STATUSDATE, STATUS, DISTRICT_TIF, TGL_MANJA, WONUM, ERRORCODE_AKHIR</p>
        </div>
      )}
      <div className="mt-4 text-center text-[10px] text-slate-400">Dashboard Monitoring Order Indihome AREA 2</div>
    </div>
  );
}