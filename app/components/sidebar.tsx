'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  const navItems = [
    { href: '/', label: 'Home', icon: '🏠' },
    { href: '/calendar', label: 'Calendar', icon: '📅' },
    { href: '/templates', label: 'Templates', icon: '⚙️' },
    { href: '/dashboard', label: 'Stats', icon: '📊' },
  ]

  const isActive = (href: string) => {
    if (href === '/' && pathname === '/') return true
    if (href !== '/' && pathname.startsWith(href)) return true
    return false
  }

  const navContent = (
    <>
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setIsOpen(false)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            textDecoration: 'none',
            color: isActive(item.href) ? '#3b82f6' : '#666',
            fontWeight: isActive(item.href) ? '600' : '500',
            fontSize: '14px',
            borderLeft: isActive(item.href) ? '3px solid #3b82f6' : '3px solid transparent',
            background: isActive(item.href) ? '#f0f9ff' : 'transparent',
            transition: 'all 0.2s',
          }}
        >
          <span style={{ fontSize: '18px' }}>{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </>
  )

  return (
    <>
      {/* Mobile Hamburger */}
      <div style={{
        display: 'none',
        '@media (max-width: 767px)': {
          display: 'block',
        },
        position: 'fixed',
        top: '16px',
        left: '16px',
        zIndex: 1000,
      }}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ☰
        </button>
      </div>

      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 999,
            display: 'none',
          }}
          className="mobile-overlay"
        />
      )}

      {/* Mobile Drawer */}
      <div
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          height: '100vh',
          width: '220px',
          background: '#ffffff',
          borderRight: '0.5px solid #e5e7eb',
          zIndex: 1001,
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s ease',
          display: 'flex',
          flexDirection: 'column',
          paddingTop: '16px',
        }}
        className="mobile-drawer"
      >
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {navContent}
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div
        style={{
          display: 'none',
          position: 'fixed',
          left: 0,
          top: 0,
          width: '200px',
          height: '100vh',
          background: '#ffffff',
          borderRight: '0.5px solid #e5e7eb',
          paddingTop: '16px',
          overflowY: 'auto',
          zIndex: 100,
        }}
        className="desktop-sidebar"
      >
        {navContent}
      </div>

      <style>{`
        @media (max-width: 767px) {
          .mobile-overlay {
            display: block !important;
          }
          .mobile-drawer {
            display: flex !important;
          }
        }

        @media (min-width: 768px) {
          .desktop-sidebar {
            display: block !important;
          }
          .mobile-drawer {
            display: none !important;
          }
          .hamburger-button {
            display: none !important;
          }
        }
      `}</style>
    </>
  )
}
