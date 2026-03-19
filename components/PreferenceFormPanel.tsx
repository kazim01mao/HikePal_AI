import React from 'react';

export interface PreferenceFormData {
  mood: string;
  difficulty: 'easy' | 'medium' | 'hard';
  condition: string;
  availableTime: number; // 分钟
  maxDistance: number; // km
}

interface PreferenceFormPanelProps {
  data: PreferenceFormData;
  onChange: (data: PreferenceFormData) => void;
  showTitle?: boolean;
  className?: string;
}

const PreferenceFormPanel: React.FC<PreferenceFormPanelProps> = ({
  data,
  onChange,
  showTitle = true,
  className = '',
}) => {
  const handleMoodChange = (newMood: string) => {
    onChange({ ...data, mood: newMood });
  };

  const handleDifficultyChange = (newDifficulty: 'easy' | 'medium' | 'hard') => {
    onChange({ ...data, difficulty: newDifficulty });
  };

  const handleConditionChange = (newCondition: string) => {
    onChange({ ...data, condition: newCondition });
  };

  const handleTimeChange = (hours: number) => {
    onChange({ ...data, availableTime: hours * 60 });
  };

  const handleDistanceChange = (distance: number) => {
    onChange({ ...data, maxDistance: distance });
  };

  return (
    <div className={className}>
      {showTitle && (
        <h3 className="font-bold text-xl mb-5 flex items-center gap-2 text-gray-900">
          📋 Your Hiking Preferences
        </h3>
      )}

      <div className="space-y-5">
        {/* 心情选择 */}
        <div className="space-y-3">
          <label className="block text-xs text-gray-600 font-bold uppercase tracking-wider">
            🎯 Your Hiking Mood *
          </label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: 'peaceful', label: '🌿 Peaceful', desc: 'Relax and enjoy nature' },
              { value: 'scenic', label: '📷 Scenic', desc: 'Beautiful views & photos' },
              { value: 'social', label: '👥 Social', desc: 'Team interaction' },
              { value: 'challenging', label: '⛰️ Challenging', desc: 'Challenge yourself' },
              { value: 'adventurous', label: '🗻 Adventurous', desc: 'Seek thrills' },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleMoodChange(option.value)}
                className={`p-3 rounded-xl border-2 text-left transition-all duration-200 font-semibold ${
                  data.mood === option.value
                    ? 'border-hike-green bg-hike-light text-hike-dark shadow-md'
                    : 'border-gray-200 bg-gray-50 hover:border-hike-green text-gray-700'
                }`}
              >
                <div className="font-semibold text-sm">{option.label}</div>
                <div className="text-[10px] text-gray-500 mt-1">{option.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 难度选择 */}
        <div className="space-y-3">
          <label className="block text-xs text-gray-600 font-bold uppercase tracking-wider">
            📊 Physical Difficulty *
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: 'easy', label: '🟢 Easy', desc: 'Suitable for all' },
              { value: 'medium', label: '🟡 Medium', desc: 'Moderate' },
              { value: 'hard', label: '🔴 Hard', desc: 'High demand' },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleDifficultyChange(option.value as 'easy' | 'medium' | 'hard')}
                className={`p-3 rounded-xl border-2 text-left transition-all duration-200 font-semibold ${
                  data.difficulty === option.value
                    ? 'border-hike-green bg-hike-light text-hike-dark shadow-md'
                    : 'border-gray-200 bg-gray-50 hover:border-hike-green text-gray-700'
                }`}
              >
                <div className="font-semibold text-sm">{option.label}</div>
                <div className="text-[10px] text-gray-500 mt-1">{option.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 具体需求 */}
        <div className="space-y-2">
          <label className="block text-xs text-gray-600 font-bold uppercase tracking-wider">
            💭 What are you looking for? (Optional)
          </label>
          <textarea
            value={data.condition}
            onChange={(e) => handleConditionChange(e.target.value)}
            placeholder="e.g., Sunrise views, good for photos, near water, family-friendly"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-hike-green bg-gray-50/50 focus:bg-white transition-colors h-20 resize-none text-sm"
          />
        </div>

        {/* 可用时间 */}
        <div className="space-y-2">
          <label className="block text-xs text-gray-600 font-bold uppercase tracking-wider">
            ⏱️ How much time do you have? (Hours)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="text"
              inputMode="decimal"
              value={data.availableTime === 0 ? '' : data.availableTime / 60}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  handleTimeChange(0);
                  return;
                }
                const parsed = parseFloat(val);
                if (!isNaN(parsed)) handleTimeChange(parsed);
              }}
              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-hike-green bg-gray-50/50 focus:bg-white transition-colors text-sm"
              placeholder="e.g., 5"
            />
            <span className="text-sm font-bold text-hike-green whitespace-nowrap w-20 text-right">
              {Math.floor(data.availableTime / 60)}h {data.availableTime % 60 > 0 ? `${Math.round(data.availableTime % 60)}m` : ''}
            </span>
          </div>
        </div>

        {/* 最大距离 */}
        <div className="space-y-2">
          <label className="block text-xs text-gray-600 font-bold uppercase tracking-wider">
            📏 Max Distance (km)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="text"
              inputMode="numeric"
              value={data.maxDistance === 0 ? '' : data.maxDistance}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  handleDistanceChange(0);
                  return;
                }
                const parsed = Number(val);
                if (!isNaN(parsed)) handleDistanceChange(parsed);
              }}
              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-hike-green bg-gray-50/50 focus:bg-white transition-colors text-sm"
              placeholder="e.g., 20"
            />
            <span className="text-sm font-bold text-hike-green whitespace-nowrap w-20 text-right">
              {data.maxDistance} km
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreferenceFormPanel;
