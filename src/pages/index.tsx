import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Building2, FileText, Users, Home, LogOut, Menu, X, Zap, Clock, AlertTriangle, Archive, MessageSquare } from 'lucide-react'
import { useState, useEffect } from 'react'
import type React from 'react'
import auth from '@/auth'

// Import all your pages
import Contractors from '@/components/Contractors.tsx'
import GCDetails from '@/components/GCDetails.tsx'
import GCProjects from '@/components/GCProjects.tsx'
import ProjectDetails from '@/components/ProjectDetails.tsx'
import AdminDashboard from '@/components/AdminDashboard.tsx'
import AdminManagement from '@/components/AdminManagement.tsx'
import AllDocuments from '@/components/AllDocuments.tsx'
import InsurancePrograms from '@/components/InsurancePrograms.tsx'
import BrokerPortal from '@/components/BrokerPortal.tsx'
import BrokerUpload from '@/components/BrokerUpload.tsx'
import BrokerUploadCOI from '@/components/BrokerUploadCOI.tsx'
import SubcontractorPortal from '@/components/SubcontractorPortal.tsx'
import SubcontractorDashboard from '@/components/SubcontractorDashboard.tsx'
import BrokerDashboard from '@/components/BrokerDashboard.tsx'
import ContractorDashboard from '@/components/ContractorDashboard.tsx'
import PendingReviews from '@/components/PendingReviews.tsx'
import ExpiringPolicies from '@/components/ExpiringPolicies.tsx'
import SubcontractorsManagement from '@/components/SubcontractorsManagement.tsx'
import UploadDocuments from '@/components/UploadDocuments.tsx'
import ProjectsSetup from '@/components/ProjectsSetup.tsx'
import GCDashboard from '@/components/GCDashboard.tsx'
import GCProjectView from '@/components/GCProjectView.tsx'
import SubcontractorLogin from '@/components/SubcontractorLogin.tsx'
import BrokerLogin from '@/components/BrokerLogin.tsx'
import GCLogin from '@/components/GCLogin.tsx'
import ArchivePage from '@/components/ArchivePage.tsx'
import BrokerVerification from '@/components/BrokerVerification.tsx'
import COIReview from '@/components/COIReview.tsx'
import ResetPassword from '@/components/ResetPassword.tsx'
import MessagingCenter from '@/components/MessagingCenter.tsx'
import SubEnterBrokerInfo from '@/components/SubEnterBrokerInfo.tsx'

// Unused interfaces - kept for future use
// interface NavItem {
//   path: string
//   label: string
//   icon: LucideIcon
// }

// interface SidebarProps {
//   onLogout: () => void
// }

// interface PagesProps {
//   onLogout: () => void
// }

interface GCData {
  id: string
  [key: string]: unknown
}

interface BrokerData {
  email: string
  name?: string
  [key: string]: unknown
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 30000,
    },
  },
})

function Sidebar({ onLogout }) {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  
  const navItems = [
    { path: '/', label: 'Dashboard', icon: Home },
    { path: '/contractors', label: 'Contractors', icon: Building2 },
    { path: '/documents', label: 'Documents', icon: FileText },
    { path: '/messages', label: 'Messages', icon: MessageSquare },
    { path: '/pending-reviews', label: 'Pending Reviews', icon: Clock },
    { path: '/expiring-policies', label: 'Expiring Policies', icon: AlertTriangle },
    { path: '/insurance-programs', label: 'Programs', icon: Zap },
    { path: '/archives', label: 'Archives', icon: Archive },
    { path: '/admin-management', label: 'Manage Admins', icon: Users },
  ]

  const isActive = (path: string): boolean => location.pathname === path

  return (
    <div className={`h-screen bg-white border-r border-slate-200 flex flex-col transition-all duration-300 ${collapsed ? 'w-24' : 'w-80'} shadow-sm`}>
      <div className="p-6 flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-red-600 via-rose-500 to-orange-500 rounded-xl flex items-center justify-center hover:scale-110 transition-all duration-300 hover:rotate-6 shadow-md hover:shadow-lg">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-red-600 to-rose-600 bg-clip-text text-transparent">compliant.team</span>
          </div>
        )}
        {collapsed && (
          <div className="w-10 h-10 bg-gradient-to-br from-red-600 via-rose-500 to-orange-500 rounded-xl flex items-center justify-center mx-auto hover:scale-110 transition-all duration-300 hover:rotate-6 shadow-md hover:shadow-lg">
            <Building2 className="w-6 h-6 text-white" />
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
        </button>
      </div>
      
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-4 px-4 py-3 rounded-lg transition-all text-sm font-medium ${
                isActive(item.path)
                  ? 'bg-red-100 text-red-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
              title={collapsed ? item.label : ''}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-slate-200">
        <button
          onClick={onLogout}
          className="flex items-center gap-4 px-4 py-3 rounded-lg w-full text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all text-sm font-medium"
          title={collapsed ? 'Logout' : ''}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  )
}

export default function Pages({ onLogout }) {
  // Determine which portal to show based on CURRENT PATH and AUTHENTICATION
  // Don't use sessionStorage flags that can conflict between tabs
  
  // Check if this is an admin portal request (has admin token)
  const _hasAdminToken = auth.getToken && auth.getToken()
  const _isAdminPath = !window.location.pathname.startsWith('/gc-') && 
                      !window.location.pathname.startsWith('/broker-') && 
                      !window.location.pathname.startsWith('/subcontractor-') &&
                      !window.location.pathname.startsWith('/sub-')
  
  // Determine portal based on current path
  const _isOnGCPath = window.location.pathname.startsWith('/gc-')
  const _isOnBrokerPath = window.location.pathname.startsWith('/broker-')
  const _isOnSubPath = window.location.pathname.startsWith('/subcontractor-') || 
                      window.location.pathname.startsWith('/sub-')
  
  // Each portal is independent - priority is current path, not shared sessionStorage
  const [isGCPublicSession, setIsGCPublicSession] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    // GC portal routes should always enable GC public session
    // The admin token won't hijack GC routes - they're separate portals
    const onGCRoute = window.location.pathname.startsWith('/gc-dashboard') || 
                      window.location.pathname.startsWith('/gc-project') ||
                      window.location.pathname.startsWith('/gc-login');
    return onGCRoute;
  })

  const [isBrokerPublicSession, setIsBrokerPublicSession] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    // Broker portal routes should always enable broker public session
    const isBrokerPath = window.location.pathname.startsWith('/broker-dashboard') || 
                         window.location.pathname.startsWith('/broker-upload-coi') || 
                         window.location.pathname.startsWith('/broker-upload') ||
                         window.location.pathname.startsWith('/broker-login');
    return isBrokerPath;
  })

  const [isSubPublicSession, setIsSubPublicSession] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    // Subcontractor portal routes should always enable sub public session
    const path = window.location.pathname
    const isSubPath = (
      path.startsWith('/subcontractor-dashboard') ||
      path.startsWith('/sub-enter-broker-info') ||
      path.startsWith('/broker-verification') ||
      path.startsWith('/subcontractor-login')
    );
    return isSubPath;
  })

  // Check broker routes FIRST (before sub routes)
  // Now requires authentication via BrokerLogin
  useEffect(() => {
    if (typeof window === 'undefined') return
    const isBrokerRoute = window.location.pathname.startsWith('/broker-dashboard') || 
                          window.location.pathname.startsWith('/broker-upload-coi') || 
                          window.location.pathname.startsWith('/broker-upload') ||
                          window.location.pathname.startsWith('/broker-login')
    if (isBrokerRoute) {
      // Check if authenticated (not required for login page)
      const isAuthenticated = sessionStorage.getItem('brokerAuthenticated') === 'true'

      // Allow token-based public access to broker upload flow without prior login
      const params = new URLSearchParams(window.location.search)
      const hasToken = !!params.get('token')
      const isUploadFlow = window.location.pathname.startsWith('/broker-upload-coi') || window.location.pathname.startsWith('/broker-upload')

      if (!isAuthenticated && window.location.pathname !== '/broker-login') {
        if (isUploadFlow && hasToken) {
          // Skip login redirect for public token links; enable broker public session
          sessionStorage.setItem('brokerPublicSession', 'true')
        } else {
          // Redirect to login for other broker routes
          window.location.href = '/broker-login'
          return
        }
      }
      
      // SECURITY: Do NOT read broker email/name from URL parameters
      // Only trust credentials stored during authentication
      sessionStorage.setItem('brokerPublicSession', 'true')
      // Clear any sub session
      sessionStorage.removeItem('subPublicSession')
      setIsBrokerPublicSession(true)
      setIsSubPublicSession(false)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const path = window.location.pathname
    const isSubRoute = path.startsWith('/subcontractor-dashboard') || path.startsWith('/sub-enter-broker-info') || path.startsWith('/broker-verification') || path.startsWith('/subcontractor-login')
    if (isSubRoute) {
      // sub-enter-broker-info and broker-verification use token auth; login page is public
      const requiresAuth = !(path.startsWith('/sub-enter-broker-info') || path.startsWith('/broker-verification') || path.startsWith('/subcontractor-login'))
      const isAuthenticated = sessionStorage.getItem('subAuthenticated') === 'true'
      
      if (requiresAuth && !isAuthenticated && window.location.pathname !== '/subcontractor-login') {
        // Redirect to login
        window.location.href = '/subcontractor-login'
        return
      }
      
      const params = new URLSearchParams(window.location.search)
      const subId = params.get('id') || params.get('subId')
      sessionStorage.setItem('subPublicSession', 'true')
      // Clear any broker session
      sessionStorage.removeItem('brokerPublicSession')
      if (subId) sessionStorage.setItem('subPortalId', subId)

      // Do NOT clear existing token; keep session for API access
      setIsSubPublicSession(true)
      setIsBrokerPublicSession(false)
    }
  }, [])

  // If we are in sub public mode but the path drifted, force back to the sub dashboard with the stored id
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!isSubPublicSession) return
    const params = new URLSearchParams(window.location.search)
    let subId = params.get('id') || sessionStorage.getItem('subPortalId')
    const allowedPaths = ['/subcontractor-dashboard', '/broker-verification', '/sub-enter-broker-info', '/subcontractor-login']
    if (!allowedPaths.includes(window.location.pathname)) {
      const target = subId ? `/subcontractor-dashboard?id=${subId}` : '/subcontractor-dashboard'
      window.location.replace(target)
    }
  }, [isSubPublicSession])

  // If we are in broker public mode but the path drifted, force back to broker dashboard
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!isBrokerPublicSession) return
    const allowedPaths = ['/broker-dashboard', '/broker-upload-coi', '/broker-upload', '/broker-login']
    if (!allowedPaths.includes(window.location.pathname)) {
      // SECURITY: Don't pass credentials in URL, redirect to dashboard without params
      window.location.replace('/broker-dashboard')
    }
  }, [isBrokerPublicSession])

  const isGCRoute = (() => {
    if (typeof window === 'undefined') return false
    // Only treat /gc-dashboard, /gc-project, /gc-login as GC public routes
    // /gc-details is admin-only
    return window.location.pathname.startsWith('/gc-dashboard') || 
           window.location.pathname.startsWith('/gc-project') ||
           window.location.pathname.startsWith('/gc-login')
  })()

  // If an admin token exists and we're not on a GC public route, disable GC public mode
  useEffect(() => {
    if (auth.getToken && auth.getToken()) {
      // Admin is authenticated - clear any GC public session ONLY if not on a GC route
      if (isGCPublicSession && !isGCRoute) {
        console.log('🔐 Admin authenticated, disabling GC public session');
        sessionStorage.removeItem('gcPublicSession')
        sessionStorage.removeItem('gcPortalId')
        sessionStorage.removeItem('gcAuthenticated')
        setIsGCPublicSession(false)
      }
    }
  }, [isGCPublicSession, isGCRoute])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const gcId = params.get('id')
    if (isGCRoute) {
      // Check if authenticated OR if portal link has ID parameter
      const isAuthenticated = sessionStorage.getItem('gcAuthenticated') === 'true'
      const hasValidPortalLink = !!gcId // Portal link with ID doesn't require authentication
      
      if (!isAuthenticated && !hasValidPortalLink && window.location.pathname !== '/gc-login') {
        // Redirect to login but preserve the intended destination
        const returnUrl = window.location.pathname + window.location.search
        window.location.href = `/gc-login?returnUrl=${encodeURIComponent(returnUrl)}`
        return
      }

      // Always set GC session if on any GC route (login or dashboard)
      // Login page should render even without authentication
      if (!sessionStorage.getItem('gcPublicSession')) {
        sessionStorage.setItem('gcPublicSession', 'true')
      }
      if (gcId && !sessionStorage.getItem('gcPortalId')) {
        sessionStorage.setItem('gcPortalId', gcId)
      }
      setIsGCPublicSession(true)
    }
  }, [isGCRoute])

  // Ensure admin routes are not hijacked by a lingering GC public session flag
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!isGCRoute && isGCPublicSession) {
      // Clear GC public session state when outside GC routes
      sessionStorage.removeItem('gcPublicSession')
      // Do not clear authentication or portal id; only disable GC router in this tab
      setIsGCPublicSession(false)
    }
  }, [isGCRoute, isGCPublicSession])

  // If we are in GC public mode but the path drifted, force back to the GC dashboard with the stored id
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!isGCPublicSession) return
    const params = new URLSearchParams(window.location.search)
    let gcId = params.get('id') || sessionStorage.getItem('gcPortalId')
    const allowedPaths = ['/gc-dashboard', '/gc-project', '/gc-login', '/gc-details']
    if (!allowedPaths.includes(window.location.pathname)) {
      // If an admin link was used (e.g., /project-details?id=...), map to GC project view
      if (window.location.pathname === '/project-details') {
        const projectId = params.get('id')
        const target = projectId
          ? `/gc-project?project=${projectId}${gcId ? `&id=${gcId}` : ''}`
          : (gcId ? `/gc-dashboard?id=${gcId}` : '/gc-dashboard')
        window.location.replace(target)
      } else {
        const target = gcId ? `/gc-dashboard?id=${gcId}` : '/gc-dashboard'
        window.location.replace(target)
      }
    }
  }, [isGCPublicSession])

  if (isGCPublicSession) {
    return (
      <QueryClientProvider client={queryClient}>
        <Router>
          <div className="min-h-screen bg-slate-50">
            <Routes>
              <Route path="/gc-login" element={<GCLogin onLogin={(gcData: GCData) => {
                // Mark as authenticated and redirect to original destination
                sessionStorage.setItem('gcAuthenticated', 'true');
                sessionStorage.setItem('gcPortalId', gcData.id);
                const returnUrl = new URLSearchParams(window.location.search).get('returnUrl');
                window.location.href = returnUrl || `/gc-dashboard?id=${gcData.id}`;
              }} />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/gc-reset-password" element={<ResetPassword />} />
              <Route path="/gc-dashboard" element={<GCDashboard />} />
              <Route path="/gc-project" element={<GCProjectView />} />
              <Route path="*" element={
                <div className="p-8 text-center">
                  <AlertTriangle className="w-12 h-12 mx-auto text-red-500 mb-4" />
                  <h1 className="text-xl font-bold mb-2">Route Not Found</h1>
                  <p className="text-slate-600">Current path: {window.location.pathname}</p>
                  <p className="text-slate-600">Search: {window.location.search}</p>
                </div>
              } />
            </Routes>
          </div>
        </Router>
      </QueryClientProvider>
    )
  }

  if (isBrokerPublicSession) {
    return (
      <QueryClientProvider client={queryClient}>
        <Router>
          <div className="min-h-screen bg-slate-50">
            <Routes>
              <Route path="/broker-login" element={<BrokerLogin onLogin={(brokerData: BrokerData) => {
                // Mark as authenticated and redirect to dashboard
                sessionStorage.setItem('brokerAuthenticated', 'true');
                sessionStorage.setItem('brokerPortalEmail', brokerData.email);
                if (brokerData.name) sessionStorage.setItem('brokerPortalName', brokerData.name);
                // SECURITY: Don't pass credentials in URL, use session storage only
                window.location.href = '/broker-dashboard';
              }} />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/broker-reset-password" element={<ResetPassword />} />
              <Route path="/broker-dashboard" element={<BrokerDashboard />} />
              <Route path="/broker-upload-coi" element={<BrokerUploadCOI />} />
              <Route path="/broker-upload" element={<BrokerUpload />} />
              <Route path="*" element={<Navigate to="/broker-dashboard" replace />} />
            </Routes>
          </div>
        </Router>
      </QueryClientProvider>
    )
  }

  if (isSubPublicSession) {
    return (
      <QueryClientProvider client={queryClient}>
        <Router>
          <div className="min-h-screen bg-slate-50">
            <Routes>
              <Route path="/subcontractor-dashboard" element={<SubcontractorDashboard />} />
              <Route path="/broker-verification" element={<BrokerVerification />} />
              <Route path="/sub-enter-broker-info" element={<SubEnterBrokerInfo />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/subcontractor-reset-password" element={<ResetPassword />} />
              <Route path="/subcontractor-login" element={<SubcontractorLogin onLogin={(subId) => {
                // Redirect to dashboard after login
                window.location.href = `/subcontractor-dashboard?id=${subId}`;
              }} />} />
              <Route path="*" element={<Navigate to="/subcontractor-dashboard" replace />} />
            </Routes>
          </div>
        </Router>
      </QueryClientProvider>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="flex h-screen bg-slate-50">
          <Sidebar onLogout={onLogout} />
          <div className="flex-1 overflow-auto">
            <Routes>
              <Route path="/" element={<AdminDashboard />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin-management" element={<AdminManagement />} />
              <Route path="/pending-reviews" element={<PendingReviews />} />
              <Route path="/COIReview" element={<COIReview />} />
              <Route path="/expiring-policies" element={<ExpiringPolicies />} />
              <Route path="/archives" element={<ArchivePage />} />
              <Route path="/messages" element={<MessagingCenter />} />
              <Route path="/projects-setup" element={<ProjectsSetup />} />
              <Route path="/subcontractors-management" element={<SubcontractorsManagement />} />
              <Route path="/upload-documents" element={<UploadDocuments />} />
              <Route path="/contractors" element={<Contractors />} />
              <Route path="/gc-details" element={<GCDetails />} />
                           <Route path="/gc-projects" element={<GCProjects />} />
              <Route path="/project-details" element={<ProjectDetails />} />
              <Route path="/documents" element={<AllDocuments />} />
                           <Route path="/insurance-programs" element={<InsurancePrograms />} />
              <Route path="/broker-portal" element={<BrokerPortal />} />
              <Route path="/broker-upload" element={<BrokerUpload />} />
              <Route path="/broker-upload-coi" element={<BrokerUploadCOI />} />
              <Route path="/subcontractor-portal" element={<SubcontractorPortal />} />
              <Route path="/subcontractor-dashboard" element={<SubcontractorDashboard />} />
              <Route path="/broker-verification" element={<BrokerVerification />} />
              <Route path="/broker-dashboard" element={<BrokerDashboard />} />
              <Route path="/contractor-dashboard" element={<ContractorDashboard />} />
              <Route path="/gc-dashboard" element={<GCDashboard />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/subcontractor-login" element={<SubcontractorLogin onLogin={(subId) => {
                // Redirect to dashboard after login
                window.location.href = `/subcontractor-dashboard?id=${subId}`;
              }} />} />
            </Routes>
          </div>
        </div>
      </Router>
    </QueryClientProvider>
  )
}
