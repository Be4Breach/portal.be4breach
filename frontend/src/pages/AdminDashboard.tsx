import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, X, LogOut, Shield } from "lucide-react";

interface User {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    company_name: string;
    role: string;
    is_approved: boolean;
}

import { toast } from "react-hot-toast";
import api from "@/lib/api";

const AdminDashboard = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await api.get("/api/admin/users");
            setUsers(response.data);
        } catch (error: any) {
            console.error("Failed to fetch users", error);
            if (error.response?.status === 401 || error.response?.status === 403) {
                localStorage.removeItem("token");
                navigate("/login");
            } else {
                toast.error("Failed to load users");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (userId: string) => {
        const toastId = toast.loading("Approving user...");
        try {
            await api.put(`/api/admin/users/${userId}/approve`);

            toast.success("User approved successfully", { id: toastId });
            fetchUsers(); // Refresh list
        } catch (error) {
            console.error("Failed to approve user", error);
            toast.error("Failed to approve user", { id: toastId });
        }
    };

    const handleDelete = async (userId: string) => {
        if (!confirm("Are you sure you want to delete this user?")) return;

        const toastId = toast.loading("Deleting user...");
        try {
            await api.delete(`/api/admin/users/${userId}`);

            toast.success("User deleted successfully", { id: toastId });
            fetchUsers(); // Refresh list
        } catch (error) {
            console.error("Failed to delete user", error);
            toast.error("Failed to delete user", { id: toastId });
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        toast.success("Logged out successfully");
        navigate("/login");
    };

    if (loading) return <div className="p-8 text-center">Loading...</div>;

    return (
        <div className="min-h-screen bg-background p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <Shield className="w-8 h-8 text-primary" />
                        <h1 className="text-3xl font-bold">Admin Console</h1>
                    </div>
                    <Button variant="outline" onClick={handleLogout}>
                        <LogOut className="w-4 h-4 mr-2" />
                        Logout
                    </Button>
                </div>

                <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
                    <div className="p-6 border-b">
                        <h2 className="text-xl font-semibold">User Management</h2>
                        <p className="text-muted-foreground">Approve or reject new account requests</p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
                                <tr>
                                    <th className="px-6 py-4">Name</th>
                                    <th className="px-6 py-4">Email</th>
                                    <th className="px-6 py-4">Company</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Role</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {users.map((user) => (
                                    <tr key={user.id} className="hover:bg-muted/50 transition-colors">
                                        <td className="px-6 py-4 font-medium">{user.first_name} {user.last_name}</td>
                                        <td className="px-6 py-4">{user.email}</td>
                                        <td className="px-6 py-4">{user.company_name}</td>
                                        <td className="px-6 py-4">
                                            {user.is_approved ? (
                                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20">
                                                    Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20">
                                                    Pending
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 capitalize">{user.role}</td>
                                        <td className="px-6 py-4 text-right space-x-2">
                                            {!user.is_approved && (
                                                <Button size="sm" onClick={() => handleApprove(user.id)} className="bg-green-600 hover:bg-green-700">
                                                    <Check className="w-4 h-4 mr-1" /> Approve
                                                </Button>
                                            )}
                                            <Button size="sm" variant="destructive" onClick={() => handleDelete(user.id)}>
                                                <X className="w-4 h-4 mr-1" /> Delete
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                                {users.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                                            No users found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
