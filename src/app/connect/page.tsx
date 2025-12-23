'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent
} from '@/components/ui/card';
import { Users, MessageCircle, UsersIcon, Mic, Bell } from 'lucide-react';

export default function ConnectPage() {
  const [onlineCount, setOnlineCount] = useState<number>(0);
  const [incomingRequests] = useState([
    {
      id: 'req-1',
      requesterName: 'Alex',
      criteria: 'Lost a sibling to an accident in the last year',
      matchReason: 'Loss of a Sibling',
    },
    {
      id: 'req-2',
      requesterName: 'Taylor',
      criteria: 'Grieving a partner during the holidays',
      matchReason: 'Grieving a Partner',
    },
  ]);

  useEffect(() => {
    // In production: replace with WebSocket/Supabase real-time count
    const fetchOnlineCount = () => {
      setOnlineCount(Math.floor(Math.random() * 500) + 50);
    };
    fetchOnlineCount();
    const interval = setInterval(fetchOnlineCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const quickActions = [
    {
      id: 'one-on-one',
      title: 'Talk One-on-One',
      description: 'Get matched instantly with someone who’s been there.',
      icon: <MessageCircle className="h-6 w-6 text-primary" />,
      href: '/connect/one-on-one',
    },
    {
      id: 'group-call',
      title: 'Join a Group Call',
      description: 'Share and listen in a supportive, real-time circle.',
      icon: <UsersIcon className="h-6 w-6 text-primary" />,
      href: '/connect/group-call',
    },
    {
      id: 'live-rooms',
      title: 'Live Chat Rooms',
      description: 'Drop into topic-based conversations happening now.',
      icon: <Mic className="h-6 w-6 text-primary" />,
      href: '/connect/rooms',
    },
  ];

  const communities = [
    { name: 'Loss of a Child', members: 1240 },
    { name: 'Grieving a Partner', members: 980 },
    { name: 'Sudden Loss', members: 760 },
    { name: 'Bereavement Support', members: 2150 },
  ];

  return (
    <div className="min-h-screen bg-background py-10 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Hero */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">
            You Are Not Alone
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Press a button—someone who understands is always online. And sometimes, someone is already asking for *you*.
          </p>
          <div className="inline-flex items-center gap-2 bg-secondary px-4 py-2 rounded-full">
            <Users className="h-4 w-4" />
            <span className="font-medium">{onlineCount.toLocaleString()} people online now</span>
          </div>
        </div>

        {/* Incoming Requests */}
        {incomingRequests.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-6">
              <Bell className="h-5 w-5 text-primary" />
              <h2 className="text-2xl font-semibold">Someone Needs You</h2>
            </div>
            <div className="space-y-4">
              {incomingRequests.map((req) => (
                <Card key={req.id} className="border-l-4 border-primary bg-primary/5">
                  <CardContent className="p-5">
                    <p className="text-sm text-foreground mb-2">
                      <span className="font-medium">{req.requesterName}</span> is looking for someone who:
                    </p>
                    <p className="text-sm bg-muted p-2.5 rounded mb-3 italic">
                      &ldquo;{req.criteria}&rdquo;
                    </p>
                    <p className="text-xs text-muted-foreground mb-3">
                      <span className="font-medium">Why you’re a great fit:</span> You’re in the &ldquo;{req.matchReason}&rdquo; community and have shared similar experiences.
                    </p>
                    <div className="flex gap-3">
                      <Button variant="default" size="sm">
                        Accept Request
                      </Button>
                      <Button variant="outline" size="sm">
                        Not Now
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Quick Connect */}
        <section>
          <h2 className="text-2xl font-semibold text-center mb-8">Or Start a Conversation</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {quickActions.map((action) => (
              <Card key={action.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-start gap-4 pb-2">
                  <div className="p-2 bg-primary/10 rounded-lg">{action.icon}</div>
                  <div>
                    <CardTitle className="text-lg">{action.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm mb-4">
                    {action.description}
                  </p>
                  <Link href={action.href} className="block w-full">
                    <Button className="w-full">Connect Now</Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Communities */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">Active Support Communities</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {communities.map((community, index) => (
              <Card key={index} className="p-5 hover:bg-accent transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-sm">{community.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {community.members.toLocaleString()} members
                    </p>
                  </div>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Coming Soon */}
        <section className="bg-muted/40 p-6 rounded-xl">
          <h2 className="text-2xl font-semibold text-center mb-4">Coming Soon</h2>
          <div className="flex flex-wrap justify-center gap-6 text-muted-foreground text-sm">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-primary rounded-full"></span>
              Therapeutic Games
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-primary rounded-full"></span>
              Guided Healing Lessons
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-primary rounded-full"></span>
              Live Expert Conferences
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}