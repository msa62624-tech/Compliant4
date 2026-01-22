import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, User, Building2, Mail, Wrench } from "lucide-react";

export default function RoleSwitcher({ currentUser }) {
  const roles = [
    {
      id: "super_admin",
      label: "Super Admin Dashboard",
      icon: Shield,
      redirectTo: "AdminDashboard",
    },
    {
      id: "admin",
      label: "Admin Dashboard",
      icon: User,
      redirectTo: "AdminDashboard",
    },
    {
      id: "gc_onstar",
      label: "GC Dashboard - On Star",
      icon: Building2,
      redirectTo: "GCDashboard",
    },
    {
      id: "broker_hml",
      label: "Broker Dashboard - HML",
      icon: Mail,
      redirectTo: "BrokerDashboard?email=broker@hml.com",
    },
    {
      id: "sub_mpi",
      label: "Sub Dashboard - MPI Plumbing",
      icon: Wrench,
      redirectTo: "SubcontractorDashboard",
    },
  ];

  const handleRoleSwitch = (roleId) => {
    sessionStorage.setItem('testing_role', roleId);
    
    const selectedRole = roles.find(r => r.id === roleId);
    if (selectedRole) {
      window.location.href = `/${selectedRole.redirectTo}`;
    }
  };

  const getCurrentRoleId = () => {
    const storedRole = sessionStorage.getItem('testing_role');
    if (storedRole) return storedRole;
    
    if (currentUser?.role === "super_admin") return "super_admin";
    if (currentUser?.role === "admin") return "admin";
    
    return "super_admin";
  };

  return (
    <div className="w-full">
      <Select value={getCurrentRoleId()} onValueChange={handleRoleSwitch}>
        <SelectTrigger className="w-full bg-white border-2 border-red-200 hover:border-red-300">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {roles.map((role) => {
            const Icon = role.icon;
            return (
              <SelectItem key={role.id} value={role.id}>
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <span>{role.label}</span>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      <p className="text-xs text-slate-500 mt-1 text-center">
        Switch roles for testing
      </p>
    </div>
  );
}