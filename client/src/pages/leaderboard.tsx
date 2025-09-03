import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Trophy, ThumbsUp, ThumbsDown, Shield, Award, ChevronLeft } from "lucide-react";
import ownerIcon from "@assets/image_1732241259002.png";

export default function Leaderboard() {
  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ["/api/leaderboard"],
  });

  // Format vote count (1000 -> 1k, 999000 -> 999k, 1000000+ -> +1M)
  const formatVoteCount = (count: number) => {
    if (count >= 1000000) {
      return "+1M";
    } else if (count >= 1000) {
      const k = Math.floor(count / 1000);
      return `${k}k`;
    }
    return count.toString();
  };

  // Get reputation badge based on percentage
  const getReputationBadge = (percentage: number | null, thumbsUp: number, thumbsDown: number) => {
    const totalVotes = thumbsUp + thumbsDown;
    
    if (totalVotes === 0 || percentage === null) {
      return { badge: "Newbie", color: "#28a745" };
    } else if (percentage >= 1 && percentage <= 49) {
      return { badge: "Interesting", color: "#ffc107" };
    } else if (percentage >= 50 && percentage <= 79) {
      return { badge: "Nice", color: "#17a2b8" };
    } else if (percentage >= 80) {
      return { badge: "😎", color: null };
    } else {
      return { badge: "Newbie", color: "#28a745" };
    }
  };

  if (isLoading) {
    return (
      <div className="container py-5">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4">
      {/* Header */}
      <div className="mb-4">
        <div className="d-flex align-items-center gap-3 mb-3">
          <Link to="/" className="btn btn-sm btn-outline-secondary">
            <ChevronLeft size={16} className="me-1" />
            Back
          </Link>
          <h1 className="h3 fw-bold mb-0 flex-grow-1">
            <Trophy size={28} className="text-warning me-2" style={{ verticalAlign: 'text-bottom' }} />
            Reputation Leaderboard
          </h1>
        </div>
        <p className="text-muted">
          Top 100 users by reputation in the last 69 days
        </p>
      </div>

      {/* Leaderboard Table */}
      <div className="card">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead>
                <tr>
                  <th style={{ width: '60px', textAlign: 'center' }}>#</th>
                  <th>User</th>
                  <th style={{ textAlign: 'center' }}>Validations</th>
                  <th style={{ textAlign: 'center' }}>Votes</th>
                  <th style={{ textAlign: 'center' }}>Approval</th>
                  <th style={{ textAlign: 'center' }}>Badge</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard && leaderboard.length > 0 ? (
                  leaderboard.map((user: any, index: number) => {
                    const totalVotes = user.thumbsUp + user.thumbsDown;
                    const reputationInfo = getReputationBadge(user.percentage, user.thumbsUp, user.thumbsDown);
                    const isTop3 = index < 3;
                    
                    return (
                      <tr key={user.userId}>
                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                          {isTop3 ? (
                            <div style={{ fontSize: '24px' }}>
                              {index === 0 && '🥇'}
                              {index === 1 && '🥈'}
                              {index === 2 && '🥉'}
                            </div>
                          ) : (
                            <span style={{ fontWeight: '600', color: '#6c757d' }}>
                              {index + 1}
                            </span>
                          )}
                        </td>
                        <td style={{ verticalAlign: 'middle' }}>
                          <div className="d-flex align-items-center gap-2">
                            <img src={ownerIcon} alt="" style={{ width: '20px', height: '20px' }} />
                            <div>
                              <div style={{ fontWeight: '500' }}>
                                {user.displayName}
                              </div>
                              <small className="text-muted">
                                {user.memberStatus}
                              </small>
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                          <span style={{ fontWeight: '600' }}>
                            {formatVoteCount(user.validatedCount)}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                          <div style={{ display: 'inline-flex', gap: '12px', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <ThumbsUp size={14} className="text-success" />
                              <span style={{ fontSize: '14px', fontWeight: '500' }}>
                                {formatVoteCount(user.thumbsUp)}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <ThumbsDown size={14} className="text-danger" />
                              <span style={{ fontSize: '14px', fontWeight: '500' }}>
                                {formatVoteCount(user.thumbsDown)}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                          <div style={{
                            fontSize: '20px',
                            fontWeight: 'bold',
                            color: user.percentage !== null && user.percentage >= 80 
                              ? '#28a745'
                              : user.percentage !== null && user.percentage >= 50
                              ? '#ffc107'
                              : user.percentage !== null
                              ? '#dc3545'
                              : '#6c757d'
                          }}>
                            {user.percentage !== null ? `${user.percentage}%` : '—'}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                          {reputationInfo.badge === '😎' ? (
                            <span style={{ fontSize: '20px' }}>
                              {reputationInfo.badge}
                            </span>
                          ) : (
                            <span className="badge" style={{
                              backgroundColor: reputationInfo.color || '#6c757d',
                              color: '#fff',
                              fontSize: '11px',
                              padding: '5px 10px',
                              borderRadius: '0',
                              fontWeight: '500'
                            }}>
                              {reputationInfo.badge}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-5">
                      <div className="text-muted">
                        <Trophy size={48} className="mb-3 opacity-25" />
                        <p>No users with reputation yet</p>
                        <p className="small">Be the first to earn reputation by hosting or rating events!</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Footer Note */}
      <div className="mt-4 text-center text-muted small">
        <Shield size={16} className="me-1" style={{ verticalAlign: 'text-bottom' }} />
        Reputation resets every 69 days to keep things fresh and fair
      </div>
    </div>
  );
}