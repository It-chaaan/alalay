import { router } from 'expo-router';
import { AlalayChat } from '@/components/alalay-chat-head';

export default function AlalayAiScreen() {
  return <AlalayChat tabScreen onClose={() => router.replace('/(tabs)')} />;
}
