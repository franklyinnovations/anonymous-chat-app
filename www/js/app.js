// Ionic Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
// 'starter.services' is found in services.js
// 'starter.controllers' is found in controllers.js

var db;

var userId = null;
// var url = "http://192.168.0.6:8181";
var url = "http://chatapp-webytoz.rhcloud.com";

 
angular.module('starter', ['ionic', 'starter.controllers', 'starter.services', 'ngCordova'])

.run(function($rootScope,$ionicPlatform, $cordovaSQLite, $http, $cordovaDevice, $state, $ionicLoading,$timeout) {
    $ionicPlatform.ready(function() {
        // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
        // for form inputs)
        if (window.cordova && window.cordova.plugins && window.cordova.plugins.Keyboard) {
            cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
            cordova.plugins.Keyboard.disableScroll(true);

        }
        if (window.StatusBar) {
            // org.apache.cordova.statusbar required
            StatusBar.styleDefault();
        }
        $rootScope.socketConnect = false;
        // checking for first time or not
        db = $cordovaSQLite.openDB({
            name: 'chatAppDb.db',
            location: 'default'
        });
        if (!window.localStorage.getItem("chatAppId")) 
        $state.go("agree");
         else
           $state.go("tab.topicList");
       

    });
})

.config(function($stateProvider, $urlRouterProvider, $ionicConfigProvider) {

    // Ionic uses AngularUI Router which uses the concept of states
    // Learn more here: https://github.com/angular-ui/ui-router
    // Set up the various states which the app can be in.
    // Each state's controller can be found in controllers.js
    $stateProvider

    // setup an abstract state for the tabs directive
    .state('tab', {
        url: '/tab',
        abstract: true,
        templateUrl: 'templates/tabs.html',
        controller: 'mainCtrl'

    })

    // Each tab has its own nav history stack:

    .state('tab.chats', {
        url: '/chats',
        views: {
            'tab-chats': {
                templateUrl: 'templates/chats.html',
                controller: 'chatsCtrl'
            }
        }

    }).state('tab.topicList', {
        url: '/topicList',
        views: {
            'tab-topicList': {
                templateUrl: 'templates/topicList.html',
                controller: 'topicListCtrl'
            }
        }

    }).state('settings', {
        url: '/settings',

        templateUrl: 'templates/settings.html',
        controller: 'settingsCtrl'


    }).state('chat', {
        url: '/chat/:chatId',

        templateUrl: 'templates/chat.html',
        controller: 'chatCtrl'

    }).state('addTopic',{
        url:'/addTopic',
        templateUrl:'templates/addTopic.html',
        controller: 'addTopicCtrl'
    }).state("agree",{
        url : '/agree',
        templateUrl : 'templates/agree.html',
        controller : 'agreeCtrl'
    }).state("test",{
        url : "/test",
        templateUrl : "templates/test.html",
        controller : "testCtrl"
    });


    // if none of the above states are matched, use this as the fallback
    $urlRouterProvider.otherwise('/tab.topicList');

    $ionicConfigProvider.views.maxCache(0);
    // $ionicConfigProvider.scrolling.jsScrolling(true);

});