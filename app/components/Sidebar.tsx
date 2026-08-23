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
          { id: 'indibiz-ao', label: 'AO' },
          { id: 'indibiz-pda', label: 'PDA' },
        ],
      },
      {
        id: 'ebis',
        label: 'EBIS',
        subSubItems: [
          { id: 'ebis-ao', label: 'AO' },
          { id: 'ebis-pda', label: 'PDA' },
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
      className={`h-full bg-slate-800 text-white transition-all duration-300 ${
        isOpen ? 'w-64' : 'w-16'
      } flex flex-col relative flex-shrink-0`}
    >
      {/* Tombol Toggle */}
      <button
        onClick={toggleSidebar}
        className="p-3 text-white hover:bg-slate-700 transition-colors flex items-center gap-2 border-b border-slate-700"
      >
        {isOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
        {isOpen && <span className="font-bold">MENU</span>}
      </button>

      {/* Menu Items */}
      <nav className="flex-1 overflow-y-auto py-2">
        {menuData.map((item) => {
          const isActive = activeMenu === item.id;
          const isExpanded = expandedMenus[item.id] || false;
          const hasSubItems = item.subItems && item.subItems.length > 0;

          // Home button spesial: redirect ke landing page
          if (item.id === 'home') {
            return (
              <div
                key={item.id}
                className={`flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-slate-700 transition-colors ${
                  isActive ? 'bg-blue-600' : ''
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
                className={`flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-slate-700 transition-colors ${
                  isActive && !hasSubItems ? 'bg-blue-600' : ''
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
                <div className="bg-slate-700">
                  {item.subItems!.map((sub) => {
                    const isSubActive = activeSubMenu === sub.id;
                    const hasSubSubItems = sub.subSubItems && sub.subSubItems.length > 0;
                    const isSubExpanded = expandedSubMenus[sub.id] || false;

                    return (
                      <div key={sub.id}>
                        <div
                          className={`flex items-center justify-between pl-6 pr-4 py-2 text-sm cursor-pointer hover:bg-slate-600 transition-colors ${
                            isSubActive && !hasSubSubItems ? 'bg-blue-500' : ''
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
                          <div className="bg-slate-600">
                            {sub.subSubItems!.map((subSub) => {
                              const isSubSubActive = activeSubSubMenu === subSub.id;
                              return (
                                <div
                                  key={subSub.id}
                                  className={`pl-12 pr-4 py-2 text-xs cursor-pointer hover:bg-slate-500 transition-colors ${
                                    isSubSubActive ? 'bg-blue-400' : ''
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
      <div className="border-t border-slate-700 p-3 text-xs text-slate-400 text-center">
        {isOpen ? (
          <>
            <div className="text-slate-300 font-medium">Rudi Narto Lutfianto</div>
            <div className="text-[10px] text-slate-500">Developer</div>
          </>
        ) : (
          <div className="text-sm">👨‍💻</div>
        )}
      </div>
    </div>
  );
}