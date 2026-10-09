'use client';

import { useState } from 'react';
import { FaHome, FaChartBar, FaBars, FaTimes, FaUserTie } from 'react-icons/fa';
import { IoIosArrowDown, IoIosArrowForward } from 'react-icons/io';

interface MenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  subItems?: { id: string; label: string; subSubItems?: { id: string; label: string }[] }[];
}

const menuData: MenuItem[] = [
  {
    id: 'home',
    label: 'Home',
    icon: <FaHome />,
  },
  {
    id: 'executive-review',
    label: 'Executive Review',
    icon: <FaHome />,
  },
  {
    id: 'daily-report',
    label: 'Daily Report',
    icon: <FaChartBar />,
    subItems: [
      {
        id: 'indihome',
        label: 'INDIHOME',
        subSubItems: [
          { id: 'indihome-ao', label: 'AO' },
          { id: 'indihome-pda', label: 'PDA' },
        ],
      },
      {
        id: 'indibiz',
        label: 'INDIBIZ',
        subSubItems: [
          { id: 'indibiz-ao-pda', label: 'AO+PDA' },
        ],
      },
      {
        id: 'ebis',
        label: 'EBIS',
        subSubItems: [
          { id: 'ebis-datin', label: 'DATIN' },
          { id: 'ebis-wifi', label: 'WIFI' },
          { id: 'ebis-olo', label: 'OLO' },
          { id: 'ebis-vula', label: 'VULA' },
        ],
      },
    ],
  },
];

interface SidebarProps {
  onSelectMenu: (menuId: string, subMenuId?: string, subSubMenuId?: string) => void;
  activeMenu: string;
  activeSubMenu?: string;
  activeSubSubMenu?: string;
}

export default function Sidebar({
  onSelectMenu,
  activeMenu,
  activeSubMenu,
  activeSubSubMenu,
}: SidebarProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [expandedMenus, setExpandedMenus] = useState<{ [key: string]: boolean }>({
    'daily-report': true,
  });
  const [expandedSubMenus, setExpandedSubMenus] = useState<{ [key: string]: boolean }>({
    'indihome': true,
  });

  const toggleSidebar = () => setIsOpen(!isOpen);
  const toggleExpand = (menuId: string) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [menuId]: !prev[menuId],
    }));
  };
  const toggleSubExpand = (subMenuId: string) => {
    setExpandedSubMenus((prev) => ({
      ...prev,
      [subMenuId]: !prev[subMenuId],
    }));
  };

  // Handle klik Home -> redirect ke landing page
  const handleHomeClick = () => {
    window.location.href = '/';
  };

  return (
    <div
      className={`h-full bg-slate-900 text-white transition-all duration-300 ${
        isOpen ? 'w-64' : 'w-16'
      } relative flex flex-shrink-0 flex-col border-r border-white/5`}
    >
      {/* Tombol Toggle */}
      <button
        onClick={toggleSidebar}
        className="flex items-center gap-2 border-b border-white/10 px-4 py-4 text-white transition-colors hover:bg-white/5"
      >
        {isOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
        {isOpen && <span className="text-xs font-bold uppercase tracking-[0.22em] text-slate-200">Navigation</span>}
      </button>

      {/* Menu Items */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {menuData.map((item) => {
          const isActive = activeMenu === item.id;
          const isExpanded = expandedMenus[item.id] || false;
          const hasSubItems = item.subItems && item.subItems.length > 0;

          // Home button spesial: redirect ke landing page
          if (item.id === 'home') {
            return (
              <div
                key={item.id}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 cursor-pointer transition-colors hover:bg-white/8 ${
                  isActive ? 'bg-cyan-300 font-semibold text-slate-950 shadow-lg shadow-slate-950/20' : 'text-slate-300'
                }`}
                onClick={handleHomeClick}
              >
                {item.icon && <span className="text-lg">{item.icon}</span>}
                {isOpen && <span className="text-sm">{item.label}</span>}
              </div>
            );
          }

          return (
            <div key={item.id}>
              {/* Menu Utama */}
              <div
                className={`flex items-center justify-between rounded-xl px-3 py-3 cursor-pointer transition-colors hover:bg-white/8 ${
                  isActive && !hasSubItems ? 'bg-cyan-300 font-semibold text-slate-950' : 'text-slate-200'
                }`}
                onClick={() => {
                  if (hasSubItems) {
                    toggleExpand(item.id);
                  } else {
                    onSelectMenu(item.id);
                  }
                }}
              >
                <div className="flex items-center gap-3">
                  {item.icon && <span className="text-lg">{item.icon}</span>}
                  {isOpen && <span className="text-sm">{item.label}</span>}
                </div>
                {isOpen && hasSubItems && (
                  <span>{isExpanded ? <IoIosArrowDown /> : <IoIosArrowForward />}</span>
                )}
              </div>

              {/* Sub Menu */}
              {hasSubItems && isExpanded && isOpen && (
                <div className="mt-1 rounded-xl bg-slate-800 p-1">
                  {item.subItems!.map((sub) => {
                    const isSubActive = activeSubMenu === sub.id;
                    const hasSubSubItems = sub.subSubItems && sub.subSubItems.length > 0;
                    const isSubExpanded = expandedSubMenus[sub.id] || false;

                    return (
                      <div key={sub.id}>
                        <div
                          className={`flex items-center justify-between rounded-lg py-2.5 pl-4 pr-3 text-sm cursor-pointer transition-colors hover:bg-white/8 ${
                            isSubActive && !hasSubSubItems ? 'bg-cyan-300 text-slate-950' : 'text-slate-300'
                          }`}
                          onClick={() => {
                            if (hasSubSubItems) {
                              toggleSubExpand(sub.id);
                            } else {
                              onSelectMenu(item.id, sub.id);
                            }
                          }}
                        >
                          <span>{sub.label}</span>
                          {hasSubSubItems && (
                            <span>{isSubExpanded ? <IoIosArrowDown /> : <IoIosArrowForward />}</span>
                          )}
                        </div>

                        {/* Sub-sub Menu */}
                        {hasSubSubItems && isSubExpanded && (
                          <div className="rounded-lg bg-slate-900 px-1 py-1">
                            {sub.subSubItems!.map((subSub) => {
                              const isSubSubActive = activeSubSubMenu === subSub.id;
                              return (
                                <div
                                  key={subSub.id}
                                  className={`rounded-md py-2 pl-10 pr-3 text-xs cursor-pointer transition-colors hover:bg-white/8 ${
                                    isSubSubActive ? 'bg-cyan-200 font-semibold text-slate-950' : 'text-slate-400'
                                  }`}
                                  onClick={() => onSelectMenu(item.id, sub.id, subSub.id)}
                                >
                                  {subSub.label}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer - Developer Name */}
      <div className="border-t border-white/10 p-4 text-center text-xs text-slate-400">
        {isOpen ? (
          <>
            <div className="font-medium text-slate-200">Rudi Narto Lutfianto</div>
            <div className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">Developer</div>
          </>
        ) : (
          <div className="text-sm">👨‍💻</div>
        )}
      </div>
    </div>
  );
}