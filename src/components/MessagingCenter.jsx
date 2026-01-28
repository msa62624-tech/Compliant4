import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Send, CheckCircle2, Archive, Filter, Search } from "lucide-react";
import { format } from "date-fns";
import { sendEmail } from "@/emailHelper";
import { notificationLinks } from "@/notificationLinkBuilder";
import { toast } from "sonner";

export default function MessagingCenter() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("active");
  const [showComposeDialog, setShowComposeDialog] = useState(false);
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedRecipientType, setSelectedRecipientType] = useState("broker");
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [filterProject, setFilterProject] = useState("all");
  const [filterRecipientType, setFilterRecipientType] = useState("all");
  const [filterCarrier, setFilterCarrier] = useState("all");
  const [filterSubcontractor, setFilterSubcontractor] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch messages with role-based filtering
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["messages", currentUser?.id],
    queryFn: async () => {
      try {
        const allMessages = await apiClient.entities.Message.list("-created_date");
        
        // Role-based filtering
        if (currentUser?.role === 'super_admin') {
          // Super admin sees all messages except those between assistant admins
          return allMessages.filter(msg => {
            // Show messages sent/received by the super admin themselves
            // or messages that don't involve assistant admins
            return msg.recipient_id === currentUser.id || 
                   msg.sender_id === currentUser.id ||
                   msg.sender_type !== 'admin' || // Not from an admin
                   msg.recipient_type !== 'admin'; // Not to an admin
          });
        } else if (currentUser?.role === 'admin') {
          // Assistant admins only see their own messages
          return allMessages.filter(msg => 
            msg.recipient_id === currentUser.email || 
            msg.sender_id === currentUser.email ||
            msg.recipient_id === currentUser.id || 
            msg.sender_id === currentUser.id ||
            msg.recipient_email === currentUser.email ||
            msg.sender_email === currentUser.email
          );
        }
        
        // Default: return all messages
        return allMessages;
      } catch (error) {
        console.error('❌ Error fetching messages:', error);
        throw error;
      }
    },
    enabled: !!currentUser,
  });

  // Fetch projects for selection
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiClient.entities.Project.list(),
  });

  // Fetch project subcontractors for recipient selection
  const { data: projectSubs = [] } = useQuery({
    queryKey: ["project-subs", selectedProject],
    queryFn: () => apiClient.entities.ProjectSubcontractor.list(),
    enabled: !!selectedProject,
  });

  // Fetch subcontractors
  const { data: allSubs = [] } = useQuery({
    queryKey: ["subcontractors"],
    queryFn: async () => {
      const contractors = await apiClient.entities.Contractor.list();
      return contractors.filter(c => c.contractor_type === "subcontractor");
    },
  });

  // Fetch brokers
  const { data: brokers = [] } = useQuery({
    queryKey: ["brokers"],
    queryFn: () => apiClient.entities.Broker.list(),
  });

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: () => apiClient.auth.me(),
  });

  // Mark message as done mutation
  const markAsDoneMutation = useMutation({
    mutationFn: async (messageId) => {
      const message = messages.find(m => m.id === messageId);
      return apiClient.entities.Message.update(messageId, {
        ...message,
        status: "archived",
        archived_date: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["messages"]);
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data) => {
      // Create message in database
      const message = await apiClient.entities.Message.create(data);
      
      // Send email notifications with response link in parallel
      const emailPromises = selectedRecipients.map(recipient => {
        const recipientEmail = recipient.email;
        
        // Build response link based on recipient type
        let responseLink = "";
        if (selectedRecipientType === "broker") {
          // Broker links use name field
          responseLink = notificationLinks.getBrokerMessagesLink(recipient.name || recipientEmail);
        } else if (selectedRecipientType === "subcontractor") {
          responseLink = notificationLinks.getSubMessagesLink(recipient.id);
        }

        // Return promise for parallel execution
        return sendEmail({
          to: recipientEmail,
          subject: `Message from Admin: ${messageSubject}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #DC2626;">New Message from ${currentUser?.name || "Admin"}</h2>
              <p><strong>Subject:</strong> ${messageSubject}</p>
              <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
                ${messageBody.replace(/\n/g, '<br>')}
              </div>
              ${selectedProject ? `<p><strong>Project:</strong> ${projects.find(p => p.id === selectedProject)?.project_name || selectedProject}</p>` : ''}
              <p style="margin-top: 20px;">
                <a href="${responseLink}" style="background-color: #DC2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                  Respond to Message
                </a>
              </p>
              <p style="color: #6B7280; font-size: 12px; margin-top: 20px;">
                This message is regarding ${selectedProject ? 'your project work' : 'insurance compliance'}. 
                Please respond at your earliest convenience.
              </p>
            </div>
          `,
        });
      });
      
      // Execute all email sends in parallel for better performance
      // Using allSettled to ensure all emails are attempted even if some fail
      const results = await Promise.allSettled(emailPromises);
      
      // Track email sending results
      const failedEmails = results.filter(r => r.status === 'rejected');
      const successCount = results.length - failedEmails.length;
      
      // Log structured failure information for monitoring
      if (failedEmails.length > 0) {
        const failureDetails = results.reduce((acc, result, index) => {
          if (result.status === 'rejected') {
            acc.push({
              recipient: selectedRecipients[index]?.email || 'unknown',
              error: result.reason?.message || 'Unknown error'
            });
          }
          return acc;
        }, []);
        console.error(`Email delivery: ${successCount}/${results.length} successful`, failureDetails);
        
        // Notify user of partial failure
        toast.warning(`Message saved, but ${failedEmails.length} of ${results.length} email notification(s) failed to send. Recipients can still view the message in their inbox.`);
      }
      
      return message;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["messages"]);
      setShowComposeDialog(false);
      resetComposeForm();
    },
  });

  const resetComposeForm = () => {
    setSelectedProject("");
    setSelectedRecipientType("broker");
    setSelectedRecipients([]);
    setMessageSubject("");
    setMessageBody("");
  };

  // Get available recipients based on project and type
  const getAvailableRecipients = () => {
    if (selectedRecipientType === "broker") {
      if (selectedProject) {
        // Get brokers for subs in this project - optimized to filter first, then map
        const subsInProject = projectSubs
          .filter(ps => ps.project_id === selectedProject)
          .map(ps => ps.subcontractor_id);
        
        const subsData = allSubs.filter(s => subsInProject.includes(s.id));
        // Optimize: filter first to remove falsy values, then map, then Set
        const brokerIds = new Set(subsData.filter(s => s.broker_id).map(s => s.broker_id));
        return brokers.filter(b => brokerIds.has(b.id));
      }
      return brokers;
    } else if (selectedRecipientType === "subcontractor") {
      if (selectedProject) {
        // Get subs in this project
        const subsInProject = projectSubs
          .filter(ps => ps.project_id === selectedProject)
          .map(ps => ps.subcontractor_id);
        return allSubs.filter(s => subsInProject.includes(s.id));
      }
      return allSubs;
    }
    return [];
  };

  // Filter messages based on active tab and filters
  const getFilteredMessages = () => {
    // Combine all filters into a single pass for better performance
    return messages.filter(m => {
      // Filter by tab (active vs archived)
      if (activeTab === "active" && m.status === "archived") return false;
      if (activeTab === "archived" && m.status !== "archived") return false;

      // Filter by project
      if (filterProject !== "all" && m.project_id !== filterProject) return false;

      // Filter by recipient type
      if (filterRecipientType !== "all" && m.recipient_type !== filterRecipientType) return false;

      // Filter by carrier/broker
      if (filterCarrier !== "all") {
        const broker = brokers.find(b => b.id === filterCarrier);
        if (broker) {
          const matchesBroker = m.recipient_email?.includes(broker.email) || 
                               m.recipient_email?.includes(broker.name);
          if (!matchesBroker) return false;
        } else {
          return false;
        }
      }

      // Filter by subcontractor
      if (filterSubcontractor !== "all") {
        const sub = allSubs.find(s => s.id === filterSubcontractor);
        if (sub) {
          const matchesSub = m.recipient_email?.includes(sub.email) || 
                            m.recipient_email?.includes(sub.company_name);
          if (!matchesSub) return false;
        } else {
          return false;
        }
      }

      // Filter by search query
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        const matchesSearch = m.subject?.toLowerCase().includes(query) ||
                             m.message?.toLowerCase().includes(query) ||
                             m.recipient_email?.toLowerCase().includes(query) ||
                             m.sender_email?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      return true;
    });
  };

  const filteredMessages = getFilteredMessages();
  const unreadCount = messages.filter(m => m.status === "unread").length;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-red-900 mb-2 flex items-center gap-2">
                <MessageSquare className="w-6 h-6" />
                Messaging Center
                {currentUser?.role === 'admin' && (
                  <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-700 border-blue-200">
                    Assistant Admin
                  </Badge>
                )}
                {currentUser?.role === 'super_admin' && (
                  <Badge variant="outline" className="ml-2 bg-purple-50 text-purple-700 border-purple-200">
                    Super Admin
                  </Badge>
                )}
              </h2>
              <p className="text-red-700">
                Send messages to brokers and subcontractors. They&apos;ll receive an email with a link to respond.
                {currentUser?.role === 'admin' && (
                  <span className="block mt-1 text-sm text-red-600">
                    You are viewing only messages assigned to you.
                  </span>
                )}
              </p>
            </div>
            <Button 
              onClick={() => setShowComposeDialog(true)}
              className="bg-red-600 hover:bg-red-700"
            >
              <Send className="w-4 h-4 mr-2" />
              Compose Message
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Card */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{unreadCount}</div>
            <div className="text-sm text-slate-600">Unread Messages</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-slate-700">
              {messages.filter(m => m.status !== "archived").length}
            </div>
            <div className="text-sm text-slate-600">Active Messages</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-slate-500">
              {messages.filter(m => m.status === "archived").length}
            </div>
            <div className="text-sm text-slate-600">Archived</div>
          </CardContent>
        </Card>
      </div>

      {/* Messages List */}
      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between mb-3">
            <CardTitle>Messages</CardTitle>
            {/* Search Bar */}
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-500">Filters</div>
            <div className="flex items-center gap-3">
              <Filter className="w-4 h-4 text-slate-500" />
              <Select value={filterProject} onValueChange={setFilterProject}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.project_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterRecipientType} onValueChange={setFilterRecipientType}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="broker">Brokers</SelectItem>
                  <SelectItem value="subcontractor">Subcontractors</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterCarrier} onValueChange={setFilterCarrier}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by carrier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Carriers</SelectItem>
                  {brokers.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name || b.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterSubcontractor} onValueChange={setFilterSubcontractor}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by sub" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subs</SelectItem>
                  {allSubs.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="border-b px-6">
              <TabsList className="bg-transparent">
                <TabsTrigger value="active">
                  Active ({messages.filter(m => m.status !== "archived").length})
                </TabsTrigger>
                <TabsTrigger value="archived">
                  Archived ({messages.filter(m => m.status === "archived").length})
                </TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="active" className="m-0">
              {messagesLoading ? (
                <div className="p-12 text-center text-slate-500">Loading messages...</div>
              ) : filteredMessages.length === 0 ? (
                <div className="p-12 text-center">
                  <MessageSquare className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No Active Messages</h3>
                  <p className="text-slate-600">Send a message to get started</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredMessages.map((message) => (
                    <div key={message.id} className="p-6 hover:bg-slate-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-slate-900">{message.subject}</h3>
                            {message.status === "unread" && (
                              <Badge className="bg-red-100 text-red-700">Unread</Badge>
                            )}
                            <Badge variant="outline">{message.recipient_type}</Badge>
                          </div>
                          <p className="text-sm text-slate-600 mb-2">{message.message}</p>
                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            {currentUser?.role === 'super_admin' && message.recipient_names ? (
                              <span className="font-medium text-slate-700">
                                To: {message.recipient_names} ({message.recipient_type})
                              </span>
                            ) : (
                              <span>To: {message.recipient_email}</span>
                            )}
                            <span>•</span>
                            <span>{format(new Date(message.created_date || Date.now()), "MMM d, yyyy h:mm a")}</span>
                            {message.project_id && (
                              <>
                                <span>•</span>
                                <span>
                                  Project: {projects.find(p => p.id === message.project_id)?.project_name || message.project_id}
                                </span>
                                {currentUser?.role === 'super_admin' && (() => {
                                  const project = projects.find(p => p.id === message.project_id);
                                  return project?.assigned_admin_email ? (
                                    <>
                                      <span>•</span>
                                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                        Assigned: {project.assigned_admin_email}
                                      </Badge>
                                    </>
                                  ) : null;
                                })()}
                              </>
                            )}
                            {currentUser?.role === 'super_admin' && message.sender_name && message.sender_type === 'admin' && (
                              <>
                                <span>•</span>
                                <span className="text-blue-600 font-medium">
                                  Sent by: {message.sender_name}
                                  {message.sender_email && ` (${message.sender_email})`}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => markAsDoneMutation.mutate(message.id)}
                          className="ml-4"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Mark as Done
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="archived" className="m-0">
              {filteredMessages.length === 0 ? (
                <div className="p-12 text-center">
                  <Archive className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No Archived Messages</h3>
                  <p className="text-slate-600">Completed messages will appear here</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredMessages.map((message) => (
                    <div key={message.id} className="p-6 bg-slate-50">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-slate-700">{message.subject}</h3>
                          <Badge variant="outline" className="bg-slate-100">{message.recipient_type}</Badge>
                        </div>
                        <p className="text-sm text-slate-600 mb-2">{message.message}</p>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          {currentUser?.role === 'super_admin' && message.recipient_names ? (
                            <span className="font-medium text-slate-700">
                              To: {message.recipient_names} ({message.recipient_type})
                            </span>
                          ) : (
                            <span>To: {message.recipient_email}</span>
                          )}
                          <span>•</span>
                          <span>Archived: {format(new Date(message.archived_date || message.created_date), "MMM d, yyyy")}</span>
                          {message.project_id && (
                            <>
                              <span>•</span>
                              <span>
                                Project: {projects.find(p => p.id === message.project_id)?.project_name || message.project_id}
                              </span>
                              {currentUser?.role === 'super_admin' && (() => {
                                const project = projects.find(p => p.id === message.project_id);
                                return project?.assigned_admin_email ? (
                                  <>
                                    <span>•</span>
                                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                      Assigned: {project.assigned_admin_email}
                                    </Badge>
                                  </>
                                ) : null;
                              })()}
                            </>
                          )}
                          {currentUser?.role === 'super_admin' && message.sender_name && message.sender_type === 'admin' && (
                            <>
                              <span>•</span>
                              <span className="text-blue-600 font-medium">
                                Sent by: {message.sender_name}
                                {message.sender_email && ` (${message.sender_email})`}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Compose Message Dialog */}
      {showComposeDialog && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="border-b">
              <CardTitle>Compose New Message</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label>Project (Optional)</Label>
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No Project</SelectItem>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.project_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Recipient Type</Label>
                <Select value={selectedRecipientType} onValueChange={setSelectedRecipientType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="broker">Broker</SelectItem>
                    <SelectItem value="subcontractor">Subcontractor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Recipients</Label>
                <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                  {getAvailableRecipients().map(recipient => (
                    <label key={recipient.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedRecipients.some(r => r.id === recipient.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRecipients([...selectedRecipients, recipient]);
                          } else {
                            setSelectedRecipients(selectedRecipients.filter(r => r.id !== recipient.id));
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">
                        {recipient.name || recipient.company_name} ({recipient.email})
                      </span>
                    </label>
                  ))}
                  {getAvailableRecipients().length === 0 && (
                    <p className="text-sm text-slate-500">
                      {selectedProject 
                        ? `No ${selectedRecipientType}s found for this project` 
                        : `No ${selectedRecipientType}s available`}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  value={messageSubject}
                  onChange={(e) => setMessageSubject(e.target.value)}
                  placeholder="Enter message subject..."
                />
              </div>

              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  placeholder="Enter your message..."
                  rows={6}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowComposeDialog(false);
                    resetComposeForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (!messageSubject || !messageBody || selectedRecipients.length === 0) {
                      toast.error("Please fill in all required fields and select at least one recipient");
                      return;
                    }
                    
                    sendMessageMutation.mutate({
                      sender_type: "admin",
                      sender_id: currentUser?.id,
                      sender_name: currentUser?.name || "Admin",
                      sender_email: currentUser?.email,
                      recipient_type: selectedRecipientType,
                      recipient_email: selectedRecipients.map(r => r.email).join(", "),
                      recipient_ids: selectedRecipients.map(r => r.id).join(", "), // Store recipient IDs for linking
                      recipient_names: selectedRecipients.map(r => r.name || r.company_name).join(", "), // Store names for display
                      project_id: selectedProject || null,
                      subject: messageSubject,
                      message: messageBody,
                      status: "sent",
                      created_date: new Date().toISOString(),
                    });
                  }}
                  disabled={sendMessageMutation.isPending}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {sendMessageMutation.isPending ? "Sending..." : "Send Message"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
