import React from 'react';
import { AdminUser } from '../../commerce/models';
import { FeatureSwitchesPanel } from '../components/FeatureSwitchesPanel';
import { Info } from 'lucide-react';

interface FeaturesScreenProps {
  tenantId: string;
  currentUser: AdminUser;
}

export const FeaturesScreen: React.FC<FeaturesScreenProps> = ({
  tenantId,
  currentUser,
}) => {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-start gap-3 text-xs text-indigo-900 shadow-2xs">
        <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block text-indigo-950 mb-0.5">Feature Switches Location Update</span>
          <span>
            Feature switches are managed here as a dedicated brand settings page so Branding can stay focused on visual presentation.
          </span>
        </div>
      </div>

      <FeatureSwitchesPanel tenantId={tenantId} currentUser={currentUser} />
    </div>
  );
};

