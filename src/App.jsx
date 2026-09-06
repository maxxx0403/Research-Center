import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Reserve from "./pages/Reserve";
import AdminLayout from "./components/AdminLayout";
import StaffLayout from "./components/StaffLayout";
import UserLayout from "./components/UserLayout";
import Dashboard from "./pages/admin/Dashboard";
import Reservations from "./pages/admin/Reservations";
import CalendarReservations from "./pages/admin/CalendarReservations";
import Laboratories from "./pages/admin/Laboratories";
import AdminEquipment from "./pages/admin/Equipment";
import Feedbacks from "./pages/admin/Feedbacks";
import Reports from "./pages/admin/Reports";
import ActivityLogs from "./pages/admin/ActivityLogs";
import AdminSettings from "./pages/admin/Settings";
import AdminSubmissions from "./pages/admin/AdminSubmissions";
import ImportData from "./pages/admin/ImportData";
import StaffLaboratories from "./pages/staff/StaffLaboratories";
import StaffEquipment from "./pages/staff/StaffEquipment";
import StaffReservations from "./pages/staff/StaffReservations";
import StaffDashboard from "./pages/staff/StaffDashboard";
import StaffActivityLogs from "./pages/staff/StaffActivityLogs";
import StaffReports from "./pages/staff/StaffReports";
import StaffSettings from "./pages/staff/StaffSettings";
import UserDashboard from "./pages/user/UserDashboard";
import UserReserve from "./pages/user/UserReserve";
import UserReserveEquipment from "./pages/user/UserReserveEquipment";
import UserReservations from "./pages/user/UserReservations";
import UserCalendarReservations from "./pages/user/UserCalendarReservations";
import UserFeedback from "./pages/user/UserFeedback";
import UserForms from "./pages/user/UserForms";
import UserSettings from "./pages/user/UserSettings";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () =>
<QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/user-login" element={<Navigate to="/login" replace />} />
            <Route path="/reserve" element={<Reserve />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="reservations" element={<Reservations />} />
              <Route path="calendar" element={<CalendarReservations />} />
              <Route path="laboratories" element={<Laboratories />} />
              <Route path="equipment" element={<AdminEquipment />} />
              {/* Redirect old equipment-reservations route to unified reservations page */}
              <Route path="equipment-reservations" element={<Navigate to="/admin/reservations" replace />} />
              <Route path="submissions" element={<AdminSubmissions />} />
              <Route path="feedbacks" element={<Feedbacks />} />
              <Route path="reports" element={<Reports />} />
              <Route path="activity-logs" element={<ActivityLogs />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="import-data" element={<ImportData />} />
            </Route>
            <Route path="/staff" element={<StaffLayout />}>
              <Route path="dashboard" element={<StaffDashboard />} />
              <Route path="laboratories" element={<StaffLaboratories />} />
              <Route path="equipment" element={<StaffEquipment />} />
              <Route path="reservations" element={<StaffReservations />} />
              <Route path="activity-logs" element={<StaffActivityLogs />} />
              <Route path="reports" element={<StaffReports />} />
              <Route path="settings" element={<StaffSettings />} />
            </Route>
            <Route path="/user" element={<UserLayout />}>
              <Route path="dashboard" element={<UserDashboard />} />
              <Route path="reserve" element={<UserReserve />} />
              <Route path="reserve-equipment" element={<UserReserveEquipment />} />
              <Route path="reservations" element={<UserReservations />} />
              <Route path="calendar" element={<UserCalendarReservations />} />
              <Route path="feedback" element={<UserFeedback />} />
              <Route path="forms" element={<UserForms />} />
              <Route path="settings" element={<UserSettings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>;


export default App;