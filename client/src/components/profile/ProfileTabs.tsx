type ProfileTab = "posts" | "saved" | "tagged";

interface ProfileTabsProps {
  activeTab: ProfileTab;
  onChangeTab: (tab: ProfileTab) => void;
  username?: string;
}

const ProfileTabs = ({ activeTab, onChangeTab }: ProfileTabsProps) => {
  const renderTabItemClassName = (tab: ProfileTab) =>
    `inst-profile-tab-item${activeTab === tab ? " is-active" : ""}`;

  const renderTabLinkClassName = (tab: ProfileTab) =>
    `inst-profile-tab-link${activeTab === tab ? " is-active" : ""}`;

  const labels: Record<ProfileTab, string> = {
    posts: "PUBLICACIONES",
    saved: "GUARDADO",
    tagged: "ETIQUETAS",
  };

  const panelIds: Record<ProfileTab, string> = {
    posts: "panel-posts",
    saved: "panel-saved",
    tagged: "panel-tagged",
  };

  return (
    <nav className="inst-profile-tabs" role="tablist" aria-label="Navegación de perfil">
      <div className="inst-profile-tabs-container">
        <div className={renderTabItemClassName("posts")} role="presentation" data-tab="posts">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "posts"}
            aria-controls={panelIds.posts}
            id="tab-posts"
            className={renderTabLinkClassName("posts")}
            onClick={() => onChangeTab("posts")}
          >
            <svg aria-label="Publicaciones" className="inst-profile-tab-icon" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24">
              <title>Publicaciones</title>
              <rect height="6" rx="1" ry="1" width="4.667" x="3" y="1" />
              <rect height="6" rx="1" ry="1" width="4.667" x="16.333" y="1" />
              <rect height="6" rx="1" ry="1" width="4.667" x="9.667" y="1" />
              <rect height="6" rx="1" ry="1" width="4.667" x="3" y="9" />
              <rect height="6" rx="1" ry="1" width="4.667" x="16.333" y="9" />
              <rect height="6" rx="1" ry="1" width="4.667" x="9.667" y="9" />
              <rect height="6" rx="1" ry="1" width="4.667" x="3" y="17" />
              <rect height="6" rx="1" ry="1" width="4.667" x="16.333" y="17" />
              <rect height="6" rx="1" ry="1" width="4.667" x="9.667" y="17" />
            </svg>
            <span className="inst-profile-tab-label desktop-only">{labels.posts}</span>
          </button>
        </div>

        <div className={renderTabItemClassName("saved")} role="presentation" data-tab="saved">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "saved"}
            aria-controls={panelIds.saved}
            id="tab-saved"
            className={renderTabLinkClassName("saved")}
            onClick={() => onChangeTab("saved")}
          >
            <svg aria-label="Guardado" className="inst-profile-tab-icon" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24">
              <title>Guardado</title>
              <polygon
                fill="none"
                points="20 21 12 13.44 4 21 4 3 20 3 20 21"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
            <span className="inst-profile-tab-label desktop-only">{labels.saved}</span>
          </button>
        </div>

        <div className={renderTabItemClassName("tagged")} role="presentation" data-tab="tagged">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "tagged"}
            aria-controls={panelIds.tagged}
            id="tab-tagged"
            className={renderTabLinkClassName("tagged")}
            onClick={() => onChangeTab("tagged")}
          >
            <svg aria-label="Etiquetas" className="inst-profile-tab-icon" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24">
              <title>Etiquetas</title>
              <path
                d="M21 7.48a2 2 0 0 0-2-2h-3.046a2.002 2.002 0 0 1-1.506-.683l-1.695-1.939a1 1 0 0 0-1.506 0L9.552 4.797c-.38.434-.93.682-1.506.682H5a2 2 0 0 0-2 2V19l.01.206A2 2 0 0 0 5 21h14a2 2 0 0 0 2-2V7.48ZM23 19a4 4 0 0 1-4 4H5a4 4 0 0 1-3.995-3.794L1 19V7.48a4 4 0 0 1 4-4h3.046l1.696-1.94a3 3 0 0 1 4.516 0l1.696 1.94H19a4 4 0 0 1 4 4V19Z"
                fill="currentColor"
              />
              <path
                d="M14.5 10.419a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Zm2 0a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM12 16.003c3.511 0 6.555 1.99 8.13 4.906a1 1 0 0 1-1.76.95c-1.248-2.31-3.64-3.857-6.37-3.857S6.878 19.55 5.63 21.86a1 1 0 0 1-1.76-.951c1.575-2.915 4.618-4.906 8.13-4.906Z"
                fill="currentColor"
              />
            </svg>
            <span className="inst-profile-tab-label desktop-only">{labels.tagged}</span>
          </button>
        </div>
      </div>
      <div className="inst-profile-tabs-border-bottom" />
    </nav>
  );
};

export default ProfileTabs;
