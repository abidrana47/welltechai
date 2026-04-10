(function () {
  'use strict';

  var doc = document;
  var state = {
    posts: [],
    editingPost: null,
    previewImageUrl: '',
    previewObjectUrl: ''
  };

  var flash = doc.getElementById('flash');
  var authSection = doc.getElementById('authSection');
  var appSection = doc.getElementById('appSection');
  var postsSection = doc.getElementById('postsSection');
  var loginForm = doc.getElementById('loginForm');
  var postForm = doc.getElementById('postForm');
  var postsList = doc.getElementById('postsList');
  var editorHeading = doc.getElementById('editorHeading');
  var savePostBtn = doc.getElementById('savePostBtn');
  var resetEditorBtn = doc.getElementById('resetEditorBtn');
  var previewRefreshBtn = doc.getElementById('previewRefreshBtn');
  var refreshPostsBtn = doc.getElementById('refreshPostsBtn');
  var logoutBtn = doc.getElementById('logoutBtn');
  var previewBody = doc.getElementById('previewBody');
  var previewCover = doc.getElementById('previewCover');
  var titleInput = doc.getElementById('title');
  var authorNameInput = doc.getElementById('authorName');
  var statusInput = doc.getElementById('status');
  var imageAltInput = doc.getElementById('imageAlt');
  var imageInput = doc.getElementById('image');
  var excerptInput = doc.getElementById('excerpt');
  var bodyHtmlInput = doc.getElementById('bodyHtml');
  var removeImageInput = doc.getElementById('removeImage');
  var postIdInput = doc.getElementById('postId');

  function getApiBase() {
    var host = window.location.hostname;
    var port = window.location.port;
    var isLocalHost = host === 'localhost' || host === '127.0.0.1';

    if (isLocalHost && port && port !== '3000') {
      return window.location.protocol + '//' + host + ':3000';
    }

    return '';
  }

  function getApiUrl(path) {
    return getApiBase() + path;
  }

  function getArticleUrl(slug) {
    var encodedSlug = encodeURIComponent(slug);
    var host = window.location.hostname;
    var port = window.location.port;
    var isLocalHost = host === 'localhost' || host === '127.0.0.1';

    if (isLocalHost && port && port !== '3000') {
      return '/blog/_post.html?slug=' + encodedSlug;
    }

    return '/blog/' + encodedSlug;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(value) {
    if (!value) return 'Draft';

    try {
      return new Date(value).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return value;
    }
  }

  function showFlash(type, message) {
    flash.className = 'flash ' + type;
    flash.textContent = message;
    flash.classList.remove('hidden');
    window.clearTimeout(showFlash._timer);
    showFlash._timer = window.setTimeout(function () {
      flash.classList.add('hidden');
    }, 4200);
  }

  function setAuthenticated(isAuthenticated) {
    authSection.classList.toggle('hidden', isAuthenticated);
    appSection.classList.toggle('hidden', !isAuthenticated);
    postsSection.classList.toggle('hidden', !isAuthenticated);
  }

  async function fetchJson(url, options) {
    var requestOptions = options ? Object.assign({}, options) : {};
    if (!requestOptions.credentials) {
      requestOptions.credentials = 'include';
    }

    var response = await fetch(getApiUrl(url), requestOptions);
    var payload = await response.json().catch(function () {
      return {};
    });

    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || 'Request failed.');
    }

    return payload;
  }

  function resetPreviewObjectUrl() {
    if (state.previewObjectUrl) {
      URL.revokeObjectURL(state.previewObjectUrl);
      state.previewObjectUrl = '';
    }
  }

  function setPreviewImage(src, alt) {
    if (!src) {
      previewCover.classList.add('hidden');
      previewCover.innerHTML = '';
      return;
    }

    previewCover.classList.remove('hidden');
    previewCover.innerHTML =
      '<img src="' +
      escapeHtml(src) +
      '" alt="' +
      escapeHtml(alt || titleInput.value || 'Blog cover image') +
      '">';
  }

  function renderPreview() {
    var heading = titleInput.value.trim() || 'Preview will appear here';
    var excerpt = excerptInput.value.trim();
    var body = bodyHtmlInput.value.trim();
    var author = authorNameInput.value.trim() || 'WellTechAI CIC';
    var status = statusInput.value;

    previewBody.innerHTML =
      '<div class="status-chip ' +
      (status === 'draft' ? 'draft' : 'published') +
      '">' +
      escapeHtml(status) +
      '</div>' +
      '<h2 style="margin-top:14px">' +
      escapeHtml(heading) +
      '</h2>' +
      '<p style="color:var(--muted);margin-top:8px">' +
      escapeHtml(author) +
      '</p>' +
      (excerpt
        ? '<p style="margin-top:14px;color:var(--muted)">' + escapeHtml(excerpt) + '</p>'
        : '') +
      '<div style="margin-top:18px">' +
      (body || '<p>Start typing HTML to preview the article body.</p>') +
      '</div>';

    if (imageInput.files && imageInput.files[0]) {
      resetPreviewObjectUrl();
      state.previewObjectUrl = URL.createObjectURL(imageInput.files[0]);
      setPreviewImage(state.previewObjectUrl, imageAltInput.value);
      return;
    }

    if (removeImageInput.checked) {
      setPreviewImage('', '');
      return;
    }

    setPreviewImage(state.previewImageUrl, imageAltInput.value);
  }

  function resetEditor() {
    postForm.reset();
    postIdInput.value = '';
    authorNameInput.value = 'WellTechAI CIC';
    statusInput.value = 'published';
    editorHeading.textContent = 'Create a new blog post';
    savePostBtn.textContent = 'Create post';
    state.editingPost = null;
    state.previewImageUrl = '';
    resetPreviewObjectUrl();
    renderPreview();
  }

  function populateEditor(post) {
    state.editingPost = post;
    postIdInput.value = post.id;
    titleInput.value = post.title || '';
    authorNameInput.value = post.author_name || 'WellTechAI CIC';
    statusInput.value = post.status || 'draft';
    imageAltInput.value = post.image_alt || '';
    excerptInput.value = post.excerpt || '';
    bodyHtmlInput.value = post.body_html || '';
    removeImageInput.checked = false;
    imageInput.value = '';
    editorHeading.textContent = 'Edit blog post';
    savePostBtn.textContent = 'Update post';
    state.previewImageUrl = post.cover_image_url || '';
    resetPreviewObjectUrl();
    renderPreview();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function createPostCard(post) {
    var article = doc.createElement('article');
    article.className = 'post-card';

    var actions = [];
    actions.push(
      '<button class="btn-secondary" type="button" data-action="edit" data-id="' +
        escapeHtml(post.id) +
        '">Edit</button>'
    );
    actions.push(
      '<a class="btn-ghost" href="' +
        escapeHtml(getArticleUrl(post.slug)) +
        '" target="_blank" rel="noopener noreferrer">View</a>'
    );
    actions.push(
      '<button class="btn-ghost" type="button" data-action="toggle" data-id="' +
        escapeHtml(post.id) +
        '" data-status="' +
        escapeHtml(post.status || 'draft') +
        '">' +
        (post.status === 'published' ? 'Move to draft' : 'Publish now') +
        '</button>'
    );
    actions.push(
      '<button class="btn-danger" type="button" data-action="delete" data-id="' +
        escapeHtml(post.id) +
        '">Delete</button>'
    );

    article.innerHTML =
      '<div class="status-chip ' +
      (post.status === 'published' ? 'published' : 'draft') +
      '">' +
      escapeHtml(post.status || 'draft') +
      '</div>' +
      '<h3 style="margin-top:12px">' +
      escapeHtml(post.title) +
      '</h3>' +
      '<div class="post-meta">' +
      '<span>' +
      escapeHtml(post.slug) +
      '</span>' +
      '<span>' +
      escapeHtml(formatDate(post.published_at || post.created_at)) +
      '</span>' +
      '<span>' +
      escapeHtml(String(post.read_time_minutes || 1)) +
      ' min read</span>' +
      '</div>' +
      '<p>' +
      escapeHtml(post.excerpt || '') +
      '</p>' +
      '<div class="post-actions" style="margin-top:16px">' +
      actions.join('') +
      '</div>';

    return article;
  }

  function renderPosts(posts) {
    postsList.innerHTML = '';

    if (!posts.length) {
      postsList.innerHTML =
        '<div class="post-card"><h3>No posts yet</h3><p>Create your first blog post using the editor above.</p></div>';
      return;
    }

    for (var i = 0; i < posts.length; i += 1) {
      postsList.appendChild(createPostCard(posts[i]));
    }
  }

  async function loadPosts() {
    postsList.innerHTML =
      '<div class="post-card"><h3>Loading posts...</h3><p>Please wait while the dashboard refreshes.</p></div>';

    var payload = await fetchJson('/api/blog-posts?all=1');

    state.posts = Array.isArray(payload.posts) ? payload.posts : [];
    renderPosts(state.posts);
  }

  async function checkSession() {
    try {
      var payload = await fetchJson('/api/dash-session');

      var authenticated = !!payload.authenticated;
      setAuthenticated(authenticated);
      if (authenticated) {
        resetEditor();
        await loadPosts();
      }
    } catch (error) {
      setAuthenticated(false);
      showFlash('error', error.message || 'Unable to verify dashboard session.');
    }
  }

  async function handleLogin(event) {
    event.preventDefault();

    try {
      var username = doc.getElementById('loginUsername').value.trim();
      var password = doc.getElementById('loginPassword').value;

      await fetchJson('/api/dash-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, password: password })
      });

      showFlash('success', 'Dashboard login successful.');
      await checkSession();
    } catch (error) {
      showFlash('error', error.message || 'Login failed.');
    }
  }

  async function handleLogout() {
    try {
      await fetchJson('/api/dash-login', {
        method: 'DELETE'
      });
      setAuthenticated(false);
      resetEditor();
      showFlash('success', 'Logged out of the dashboard.');
    } catch (error) {
      showFlash('error', error.message || 'Logout failed.');
    }
  }

  async function handleSavePost(event) {
    event.preventDefault();

    try {
      var formData = new FormData();
      formData.append('title', titleInput.value.trim());
      formData.append('author_name', authorNameInput.value.trim());
      formData.append('status', statusInput.value);
      formData.append('image_alt', imageAltInput.value.trim());
      formData.append('excerpt', excerptInput.value.trim());
      formData.append('body_html', bodyHtmlInput.value);
      formData.append('remove_image', removeImageInput.checked ? 'true' : 'false');

      if (imageInput.files && imageInput.files[0]) {
        formData.append('image', imageInput.files[0]);
      }

      var endpoint = '/api/blog-posts';
      var method = 'POST';
      if (postIdInput.value) {
        endpoint = '/api/blog-post';
        method = 'PATCH';
        formData.append('id', postIdInput.value);
      }

      await fetchJson(endpoint, {
        method: method,
        body: formData
      });

      showFlash('success', method === 'POST' ? 'Blog post created.' : 'Blog post updated.');
      resetEditor();
      await loadPosts();
    } catch (error) {
      showFlash('error', error.message || 'Unable to save the post.');
    }
  }

  async function handlePostAction(event) {
    var target = event.target;
    if (!target || !target.getAttribute('data-action')) return;

    var action = target.getAttribute('data-action');
    var id = target.getAttribute('data-id');
    if (!id) return;

    var post = state.posts.find(function (item) {
      return item.id === id;
    });
    if (!post) return;

    if (action === 'edit') {
      populateEditor(post);
      return;
    }

    if (action === 'toggle') {
      try {
        var toggleForm = new FormData();
        toggleForm.append('id', post.id);
        toggleForm.append('status', post.status === 'published' ? 'draft' : 'published');

        await fetchJson('/api/blog-post', {
          method: 'PATCH',
          body: toggleForm
        });

        showFlash('success', 'Post status updated.');
        await loadPosts();
      } catch (error) {
        showFlash('error', error.message || 'Unable to update post status.');
      }
      return;
    }

    if (action === 'delete') {
      var confirmed = window.confirm(
        'Delete "' + post.title + '"? This removes it from Supabase and attempts to remove its cover image.'
      );
      if (!confirmed) return;

      try {
        await fetchJson('/api/blog-post', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: id })
        });

        if (state.editingPost && state.editingPost.id === id) {
          resetEditor();
        }

        showFlash('success', 'Post deleted.');
        await loadPosts();
      } catch (error) {
        showFlash('error', error.message || 'Unable to delete the post.');
      }
    }
  }

  loginForm.addEventListener('submit', handleLogin);
  postForm.addEventListener('submit', handleSavePost);
  postsList.addEventListener('click', handlePostAction);
  resetEditorBtn.addEventListener('click', resetEditor);
  previewRefreshBtn.addEventListener('click', renderPreview);
  refreshPostsBtn.addEventListener('click', function () {
    loadPosts().catch(function (error) {
      showFlash('error', error.message || 'Unable to refresh posts.');
    });
  });
  logoutBtn.addEventListener('click', handleLogout);

  [titleInput, authorNameInput, statusInput, imageAltInput, excerptInput, bodyHtmlInput].forEach(
    function (element) {
      element.addEventListener('input', renderPreview);
      element.addEventListener('change', renderPreview);
    }
  );

  imageInput.addEventListener('change', renderPreview);
  removeImageInput.addEventListener('change', renderPreview);

  checkSession();
})();
