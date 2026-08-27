'use client';

import React from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';

interface TabelSisaOrderMTDProps {
  filteredData: any[];
  parseDate: (value: any) => Date | null;
  exportSection?: (elementId: string, fileName: string) => void;
}

export default function TabelSisaOrderMTD({
  filteredData,
  parseDate,
  exportSection,
}: TabelSisaOrderMTDProps) {
  // ============================================
  // HITUNG DATA MTD (1 BULAN INI - HARI INI)
  // ============================================
  const now = new Date();
  const startOfMonthDate = startOfMonth(now);
  const endOfMonthDate = endOfMonth(now);

  const mtdData = filteredData.filter((row: any) => {
    const dateCreated = parseDate(row['DATECREATED']);
    if (!dateCreated) return false;
    return dateCreated >= startOfMonthDate && dateCreated <= endOfMonthDate;
  });

  // ============================================
  // HITUNG DATA KENDALA (WORKFAIL & CANCLWORK)
  // ============================================
  const calculateKendalaData = (data: any[]) => {
    // HANYA WORKFAIL & CANCLWORK
    const allowedStatus = ['WORKFAIL', 'CANCLWORK'];
    const filtered = data.filter((row: any) => allowedStatus.includes(row['STATUS']));
    
    const districts = Array.from(new Set(filtered.map((row: any) => row['DISTRICT_TIF']))).filter(Boolean);
    
    const kendalaMap = new Map<string, Map<string, Map<string, number>>>();
    
    filtered.forEach((row: any) => {
      const district = row['DISTRICT_TIF'] || 'UNKNOWN';
      const status = row['STATUS'] || '';
      const errorCode = row['ERRORCODE_AKHIR'] || '';
      const subErrorCode = row['SUBERRORCODE_AKHIR'] || '';
      
      // KATEGORI KENDALA
      let category = '';
      if (status === 'CANCLWORK') {
        category = 'CANCEL ORDER';
      } else if (status === 'WORKFAIL') {
        category = errorCode || 'LAINNYA';
      } else {
        category = 'LAINNYA';
      }
      
      // DETAIL KENDALA
      let detail = subErrorCode || 'KOSONG';
      
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
    
    // Urutkan berdasarkan Grand Total terbesar
    const sortedCategories = Array.from(kendalaMap.keys()).sort((a, b) => {
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

  const kendalaData = calculateKendalaData(mtdData);
  const { rows: kendalaRows, districts, grandTotalOverall, grandTotalPerDistrict } = kendalaData;

  if (filteredData.length === 0 || kendalaRows.length === 0) {
    return null;
  }

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="bg-white p-3 rounded-lg shadow-md overflow-x-auto mt-6 relative pb-4">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-sm font-bold text-slate-800">
          📋 SISA ORDER TIDAK PS MTD
        </h2>
        {exportSection && (
          <button
            onClick={() => exportSection('tabel-sisaorder-mtd', 'Sisa_Order_MTD')}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-1 px-3 rounded-lg transition"
          >
            🖼️ Export PNG
          </button>
        )}
      </div>
      <p className="text-xs text-slate-500 mb-2">
        Data berdasarkan DATECREATED: {format(startOfMonthDate, 'dd MMMM yyyy')} - {format(endOfMonthDate, 'dd MMMM yyyy')}
      </p>
      <table className="w-full text-[10px] border-collapse mb-2">
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
                  if (row.category === 'CANCEL ORDER') categoryColor = 'text-red-600 font-bold';
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
                
                {/* GRAND TOTAL ROW */}
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
  );
}